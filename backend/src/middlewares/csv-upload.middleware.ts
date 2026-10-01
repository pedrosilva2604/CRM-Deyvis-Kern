import express, { type RequestHandler } from 'express';

const CSV_CONTENT_TYPE = 'text/csv';

export class CsvUploadMiddleware {
  readonly readCsvBody: RequestHandler;

  constructor(maximumFileBytes: number) {
    this.readCsvBody = express.text({ type: CSV_CONTENT_TYPE, limit: maximumFileBytes, defaultCharset: 'utf-8' });
  }
}
