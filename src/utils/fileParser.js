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

/**
 * Convert DOCX buffer to HTML for in-browser preview.
 */
async function convertDocxToHtml(buffer) {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

/**
 * Fix multer's latin1-encoded originalname to proper UTF-8.
 * Browsers send filenames as UTF-8 in multipart form data, but multer
 * decodes the Content-Disposition filename field as latin1 by default.
 */
function fixFilename(name) {
  try {
    return Buffer.from(name, 'latin1').toString('utf-8');
  } catch {
    return name;
  }
}

module.exports = { extractText, convertDocxToHtml, fixFilename };
