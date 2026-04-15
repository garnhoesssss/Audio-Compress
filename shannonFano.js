const SF_TEXT_ENCODER = new TextEncoder();
const SF_TEXT_DECODER = new TextDecoder();

class BitWriter {
  constructor() {
    this.bytes = [];
    this.currentByte = 0;
    this.bitsFilled = 0;
    this.totalBits = 0;
  }

  writeBit(bit) {
    this.currentByte = (this.currentByte << 1) | (bit & 1);
    this.bitsFilled += 1;
    this.totalBits += 1;

    if (this.bitsFilled === 8) {
      this.bytes.push(this.currentByte);
      this.currentByte = 0;
      this.bitsFilled = 0;
    }
  }

  writeCode(code) {
    for (let i = 0; i < code.length; i += 1) {
      this.writeBit(code.charCodeAt(i) === 49 ? 1 : 0);
    }
  }

  finish() {
    if (this.bitsFilled > 0) {
      this.currentByte <<= 8 - this.bitsFilled;
      this.bytes.push(this.currentByte);
      this.currentByte = 0;
      this.bitsFilled = 0;
    }

    return new Uint8Array(this.bytes);
  }
}

class BitReader {
  constructor(uint8Array) {
    this.bytes = uint8Array;
    this.byteIndex = 0;
    this.bitIndex = 0;
  }

  readBit() {
    if (this.byteIndex >= this.bytes.length) return null;
    const bit = (this.bytes[this.byteIndex] >> (7 - this.bitIndex)) & 1;
    this.bitIndex += 1;

    if (this.bitIndex === 8) {
      this.bitIndex = 0;
      this.byteIndex += 1;
    }

    return bit;
  }
}

class ShannonFanoCompressor {
  static MAGIC = [0x53, 0x46, 0x43, 0x31];

  static compressShannonFano(arrayBuffer, metadata = {}) {
    const inputBytes = new Uint8Array(arrayBuffer);
    const frequencies = new Uint32Array(256);

    for (let i = 0; i < inputBytes.length; i += 1) {
      frequencies[inputBytes[i]] += 1;
    }

    const symbols = this.#buildSymbolList(frequencies);
    const codeMap = new Map();

    if (symbols.length === 1) {
      codeMap.set(symbols[0].symbol, "0");
    } else if (symbols.length > 1) {
      this.#buildCodeTable(symbols, "", codeMap);
    }

    const writer = new BitWriter();
    for (let i = 0; i < inputBytes.length; i += 1) {
      writer.writeCode(codeMap.get(inputBytes[i]) || "0");
    }

    const encodedBytes = writer.finish();
    const mimeBytes = SF_TEXT_ENCODER.encode(metadata.mimeType || "");
    const nameBytes = SF_TEXT_ENCODER.encode(metadata.fileName || "");

    const headerSize =
      4 +
      1 +
      1 +
      4 +
      4 +
      2 +
      2 +
      2 +
      mimeBytes.length +
      nameBytes.length +
      symbols.length * 5;

    const output = new Uint8Array(headerSize + encodedBytes.length);
    const view = new DataView(output.buffer);
    let offset = 0;

    output.set(ShannonFanoCompressor.MAGIC, offset);
    offset += 4;
    view.setUint8(offset, 1);
    offset += 1;
    view.setUint8(offset, 0);
    offset += 1;
    view.setUint32(offset, inputBytes.length, true);
    offset += 4;
    view.setUint32(offset, writer.totalBits, true);
    offset += 4;
    view.setUint16(offset, symbols.length, true);
    offset += 2;
    view.setUint16(offset, mimeBytes.length, true);
    offset += 2;
    view.setUint16(offset, nameBytes.length, true);
    offset += 2;

    output.set(mimeBytes, offset);
    offset += mimeBytes.length;
    output.set(nameBytes, offset);
    offset += nameBytes.length;

    for (let i = 0; i < symbols.length; i += 1) {
      view.setUint8(offset, symbols[i].symbol);
      offset += 1;
      view.setUint32(offset, symbols[i].frequency, true);
      offset += 4;
    }

    output.set(encodedBytes, offset);
    return output.buffer;
  }

  static decompressShannonFano(compressedBuffer) {
    const input = new Uint8Array(compressedBuffer);
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    let offset = 0;

    for (let i = 0; i < ShannonFanoCompressor.MAGIC.length; i += 1) {
      if (input[offset + i] !== ShannonFanoCompressor.MAGIC[i]) {
        throw new Error("Invalid Shannon-Fano file signature.");
      }
    }
    offset += 4;

    const version = view.getUint8(offset);
    offset += 1;
    if (version !== 1) {
      throw new Error(`Unsupported Shannon-Fano version: ${version}`);
    }

    offset += 1; // flags reserved
    const originalSize = view.getUint32(offset, true);
    offset += 4;
    const bitLength = view.getUint32(offset, true);
    offset += 4;
    const symbolCount = view.getUint16(offset, true);
    offset += 2;
    const mimeLength = view.getUint16(offset, true);
    offset += 2;
    const nameLength = view.getUint16(offset, true);
    offset += 2;

    const mimeType = SF_TEXT_DECODER.decode(
      input.slice(offset, offset + mimeLength),
    );
    offset += mimeLength;
    const fileName = SF_TEXT_DECODER.decode(
      input.slice(offset, offset + nameLength),
    );
    offset += nameLength;

    const frequencies = new Uint32Array(256);
    for (let i = 0; i < symbolCount; i += 1) {
      const symbol = view.getUint8(offset);
      offset += 1;
      const frequency = view.getUint32(offset, true);
      offset += 4;
      frequencies[symbol] = frequency;
    }

    const encodedData = input.slice(offset);
    if (originalSize === 0) {
      return {
        arrayBuffer: new ArrayBuffer(0),
        metadata: { mimeType, fileName },
      };
    }

    const symbolsList = ShannonFanoCompressor.#buildSymbolList(frequencies);
    const tree = ShannonFanoCompressor.#buildDecodeTree(symbolsList);
    const reader = new BitReader(encodedData);
    const output = new Uint8Array(originalSize);

    if (symbolsList.length === 1) {
      output.fill(symbolsList[0].symbol);
      return {
        arrayBuffer: output.buffer,
        metadata: { mimeType, fileName },
      };
    }

    let outputIndex = 0;
    let bitCounter = 0;
    let node = tree;

    while (outputIndex < originalSize && bitCounter < bitLength) {
      const bit = reader.readBit();
      if (bit === null) break;
      bitCounter += 1;
      node = bit === 0 ? node.left : node.right;

      if (!node) {
        throw new Error("Corrupted Shannon-Fano bitstream.");
      }

      if (node.symbol !== null) {
        output[outputIndex] = node.symbol;
        outputIndex += 1;
        node = tree;
      }
    }

    if (outputIndex !== originalSize) {
      throw new Error("Failed to decompress Shannon-Fano payload.");
    }

    return {
      arrayBuffer: output.buffer,
      metadata: { mimeType, fileName },
    };
  }

  static #buildSymbolList(frequencies) {
    const symbols = [];
    for (let symbol = 0; symbol < frequencies.length; symbol += 1) {
      const frequency = frequencies[symbol];
      if (frequency > 0) {
        symbols.push({ symbol, frequency });
      }
    }

    symbols.sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return a.symbol - b.symbol;
    });

    return symbols;
  }

  static #buildCodeTable(symbols, prefix, codeMap) {
    if (symbols.length === 1) {
      codeMap.set(symbols[0].symbol, prefix || "0");
      return;
    }

    let bestSplitIndex = 0;
    let bestDifference = Number.POSITIVE_INFINITY;
    let leftSum = 0;
    const totalSum = symbols.reduce((sum, item) => sum + item.frequency, 0);

    for (let i = 0; i < symbols.length - 1; i += 1) {
      leftSum += symbols[i].frequency;
      const rightSum = totalSum - leftSum;
      const difference = Math.abs(leftSum - rightSum);

      if (difference < bestDifference) {
        bestDifference = difference;
        bestSplitIndex = i;
      }
    }

    const leftGroup = symbols.slice(0, bestSplitIndex + 1);
    const rightGroup = symbols.slice(bestSplitIndex + 1);

    this.#buildCodeTable(leftGroup, `${prefix}0`, codeMap);
    this.#buildCodeTable(rightGroup, `${prefix}1`, codeMap);
  }

  static #buildDecodeTree(symbols) {
    if (symbols.length === 0) {
      return null;
    }

    if (symbols.length === 1) {
      return { symbol: symbols[0].symbol, left: null, right: null };
    }

    let bestSplitIndex = 0;
    let bestDifference = Number.POSITIVE_INFINITY;
    let leftSum = 0;
    const totalSum = symbols.reduce((sum, item) => sum + item.frequency, 0);

    for (let i = 0; i < symbols.length - 1; i += 1) {
      leftSum += symbols[i].frequency;
      const rightSum = totalSum - leftSum;
      const difference = Math.abs(leftSum - rightSum);

      if (difference < bestDifference) {
        bestDifference = difference;
        bestSplitIndex = i;
      }
    }

    const leftGroup = symbols.slice(0, bestSplitIndex + 1);
    const rightGroup = symbols.slice(bestSplitIndex + 1);

    return {
      symbol: null,
      left: this.#buildDecodeTree(leftGroup),
      right: this.#buildDecodeTree(rightGroup),
    };
  }
}

async function compressShannonFano(arrayBuffer, metadata = {}) {
  return ShannonFanoCompressor.compressShannonFano(arrayBuffer, metadata);
}

async function decompressShannonFano(compressedBuffer) {
  return ShannonFanoCompressor.decompressShannonFano(compressedBuffer);
}
