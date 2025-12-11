import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class SftpApi implements ICredentialType {
  name = 'sftpApi';
  displayName = 'SFTP API';
  documentationUrl = 'https://github.com/manateeit/n8n-nodes-mbs-backup';
  properties: INodeProperties[] = [
    {
      displayName: 'Host',
      name: 'host',
      type: 'string',
      default: '',
      placeholder: 'transfer.cdg.ws',
      required: true,
      description: 'SFTP server hostname or IP address',
    },
    {
      displayName: 'Port',
      name: 'port',
      type: 'number',
      default: 22,
      required: true,
      description: 'SFTP server port (default: 22)',
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      required: true,
      description: 'SFTP username',
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'SFTP password',
    },
  ];
}
