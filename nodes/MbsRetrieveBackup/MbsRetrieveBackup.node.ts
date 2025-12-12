import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import Client from 'ssh2-sftp-client';

export class MbsRetrieveBackup implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'MBS Retrieve Backup',
    name: 'mbsRetrieveBackup',
    icon: 'file:mbsRetrieveBackup.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["companyCode"]}}',
    description: 'Download MBS PostgreSQL backup files via SFTP',
    defaults: {
      name: 'MBS Retrieve Backup',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Host',
        name: 'host',
        type: 'string',
        default: '={{$json.host}}',
        required: true,
        placeholder: 'transfer.cdg.ws',
        description: 'SFTP server hostname (can use expression from previous node)',
      },
      {
        displayName: 'Port',
        name: 'port',
        type: 'number',
        default: 22,
        required: true,
        description: 'SFTP server port',
      },
      {
        displayName: 'Username',
        name: 'username',
        type: 'string',
        default: '={{$json.username}}',
        required: true,
        placeholder: 'sftp-user',
        description: 'SFTP username (can use expression from previous node)',
      },
      {
        displayName: 'Password',
        name: 'password',
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '={{$json.password}}',
        required: true,
        description: 'SFTP password (can use expression from previous node)',
      },
      {
        displayName: 'Company Code',
        name: 'companyCode',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'CO655',
        description: 'Company code prefix (e.g., CO655 for Archtop)',
      },
      {
        displayName: 'Base Path',
        name: 'basePath',
        type: 'string',
        default: '/fromcdg/backup/',
        required: true,
        description: 'Base directory path on SFTP server',
      },
      {
        displayName: 'File Pattern',
        name: 'filePattern',
        type: 'string',
        default: '*',
        description: 'File pattern to match (default: * for all files)',
      },
      {
        displayName: 'Binary Property Name',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        required: true,
        description: 'Name of the binary property to store file data',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const host = this.getNodeParameter('host', i) as string;
        const port = this.getNodeParameter('port', i) as number;
        const username = this.getNodeParameter('username', i) as string;
        const password = this.getNodeParameter('password', i) as string;
        const companyCode = this.getNodeParameter('companyCode', i) as string;
        const basePath = this.getNodeParameter('basePath', i) as string;
        const filePattern = this.getNodeParameter('filePattern', i) as string;
        const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

        const sftp = new Client();

        try {
          // Connect to SFTP server using dynamic credentials
          await sftp.connect({
            host: host,
            port: port,
            username: username,
            password: password,
          });

          // List directories in base path to find the backup folder
          const allItems = await sftp.list(basePath);
          const directories = allItems.filter(item => item.type === 'd');

          let backupFolder;

          // Strategy 1: If there's only one directory, use it (most common case)
          if (directories.length === 1) {
            backupFolder = directories[0];
          }
          // Strategy 2: Try to find folder matching company code pattern
          else if (directories.length > 1) {
            backupFolder = directories.find((item) => {
              return item.name.startsWith(`${companyCode}-`);
            });
          }

          if (!backupFolder) {
            const foundDirs = directories.map(d => d.name).join(', ');
            throw new NodeOperationError(
              this.getNode(),
              `No backup folder found. Looking for: "${companyCode}-*". Found ${directories.length} directories: [${foundDirs}]. Base path: ${basePath}`,
              { itemIndex: i }
            );
          }

          const backupPath = `${basePath}${backupFolder.name}`;

          // Recursively get all files from backup folder
          const files = await getAllFiles(sftp, backupPath, filePattern);

          // Download each file and create an item for it
          for (const file of files) {
            const fileData = await sftp.get(file.path);

            returnData.push({
              json: {
                fileName: file.name,
                filePath: file.path,
                fileSize: file.size,
                backupFolder: backupFolder.name,
                companyCode: companyCode,
                modifyTime: file.modifyTime,
              },
              binary: {
                [binaryPropertyName]: await this.helpers.prepareBinaryData(
                  fileData as Buffer,
                  file.name,
                ),
              },
            });
          }

          await sftp.end();

        } catch (error) {
          await sftp.end();
          throw error;
        }

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error.message,
            },
            pairedItem: {
              item: i,
            },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

/**
 * Recursively get all files from a directory
 */
async function getAllFiles(
  sftp: Client,
  dirPath: string,
  pattern: string,
): Promise<Array<{ name: string; path: string; size: number; modifyTime: number }>> {
  const files: Array<{ name: string; path: string; size: number; modifyTime: number }> = [];
  const items = await sftp.list(dirPath);

  for (const item of items) {
    const itemPath = `${dirPath}/${item.name}`;

    if (item.type === 'd') {
      // Recursively process subdirectories
      const subFiles = await getAllFiles(sftp, itemPath, pattern);
      files.push(...subFiles);
    } else if (item.type === '-') {
      // Regular file
      // Check if file matches pattern
      if (pattern === '*' || matchPattern(item.name, pattern)) {
        files.push({
          name: item.name,
          path: itemPath,
          size: item.size,
          modifyTime: item.modifyTime,
        });
      }
    }
  }

  return files;
}

/**
 * Simple pattern matching (supports * wildcard)
 */
function matchPattern(fileName: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(fileName);
}
