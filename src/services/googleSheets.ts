export class GoogleSheetsService {
  private accessToken: string;

  private safeStringify(obj: any): string {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      return value;
    });
  }

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async createSpreadsheet(title: string): Promise<string> {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: this.safeStringify({
        properties: {
          title: title,
        },
        sheets: [
          {
            properties: {
              title: 'Jobs',
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create spreadsheet: ${response.statusText}`);
    }

    const data = await response.json();
    return data.spreadsheetId;
  }

  async appendRow(spreadsheetId: string, sheetName: string, values: any[]): Promise<void> {
    const range = `${sheetName}!A:Z`;
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: this.safeStringify({
        values: [values],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to append row: ${response.statusText}`);
    }
  }

  async setupHeaders(spreadsheetId: string, sheetName: string, headers: string[]): Promise<void> {
    // Check if headers exist
    const range = `${sheetName}!A1:Z1`;
    const getResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (getResponse.ok) {
      const data = await getResponse.json();
      if (data.values && data.values.length > 0) {
        // Headers already exist
        return;
      }
    }

    // Append headers
    await this.appendRow(spreadsheetId, sheetName, headers);
  }

  async clearAndAppendAll(spreadsheetId: string, sheetName: string, headers: string[], allValues: any[][]): Promise<void> {
    const range = `${sheetName}!A:Z`;
    
    // First, clear the sheet
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    // Then, append all data including headers
    const valuesToAppend = [headers, ...allValues];
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: this.safeStringify({
        values: valuesToAppend,
      }),
    });
  }
}
