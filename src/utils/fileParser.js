const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const path = require('path');

/**
 * Extract text from uploaded file buffer.
 */
async function extractText(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case '.txt':
      return buffer.toString('utf-8');

    case '.docx': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    case '.pdf': {
      const result = await pdfParse(buffer);
      return result.text;
    }

    default:
      throw new Error(`Unsupported file format: ${ext}. Supported: .txt, .docx, .pdf`);
  }
}

module.exports = { extractText };
