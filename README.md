# n8n-nodes-mbs-backup

[![NPM Version](https://img.shields.io/npm/v/n8n-nodes-mbs-backup.svg)](https://www.npmjs.com/package/n8n-nodes-mbs-backup)
[![License](https://img.shields.io/npm/l/n8n-nodes-mbs-backup.svg)](https://github.com/manateeit/n8n-nodes-mbs-backup/blob/main/LICENSE)

Custom n8n node for retrieving MBS PostgreSQL backup files via SFTP.

This node automatically finds and downloads all backup files from MBS backup directories, handling the dynamic timestamp-based folder naming that MBS uses.

## Features

- 🔐 **Secure SFTP Connection** - Encrypted file transfers
- 📁 **Automatic Folder Discovery** - Finds the latest backup folder by company code
- 🔄 **Recursive Download** - Downloads all files including subdirectories
- 🎯 **Pattern Matching** - Optional file filtering with wildcard support
- 📦 **Binary Data Output** - Files ready for S3 upload or further processing
- 🏢 **Multi-Tenant Support** - Configurable company codes for multiple MBS customers

## Installation

### Via n8n Community Nodes (Recommended)

1. Go to **Settings** → **Community Nodes** in your n8n instance
2. Click **Install a Community Node**
3. Enter: `n8n-nodes-mbs-backup`
4. Click **Install**

### Via npm (Docker/Self-Hosted)

```bash
# For Docker installations
docker exec -it <n8n-container-name> npm install -g n8n-nodes-mbs-backup

# Restart n8n
docker restart <n8n-container-name>
```

## Quick Start

### Option A: Using AWS Secrets Manager (Recommended)

This is the most secure approach - retrieve credentials dynamically from AWS Secrets Manager.

**1. Store SFTP credentials in AWS Secrets Manager:**
```bash
aws secretsmanager create-secret \
  --name mbs/sftp/credentials \
  --secret-string '{
    "host": "transfer.cdg.ws",
    "port": 22,
    "username": "your-username",
    "password": "your-password"
  }'
```

**2. Create workflow:**
```
[AWS Secrets Manager Node]
  Secret Name: mbs/sftp/credentials
  Parse JSON: Yes
  ↓
[MBS Retrieve Backup Node]
  Host: ={{$json.host}}
  Port: ={{$json.port}}
  Username: ={{$json.username}}
  Password: ={{$json.password}}
  Company Code: CO655
  Base Path: /fromcdg/backup/
```

### Option B: Hardcoded Credentials

For testing or non-production use:

**1. Add MBS Retrieve Backup Node**
- Host: `transfer.cdg.ws`
- Port: `22`
- Username: `your-sftp-username`
- Password: `your-sftp-password`
- Company Code: `CO655`
- Base Path: `/fromcdg/backup/`

### 3. What Happens Next

The node will:
1. Connect to your SFTP server
2. Find the folder matching `CO655-YYYY-MM-DD-HH-MM-SS` pattern
3. Download all `.dat.gz` files and `toc.dat`
4. Output one item per file with binary data attached

## Usage Examples

### Example 1: Download All MBS Backup Files

```
[MBS Retrieve Backup]
├─ Company Code: CO655
├─ Base Path: /fromcdg/backup/
└─ File Pattern: *
```

**Output**: All files from the latest backup folder (1,079+ .dat.gz files + toc.dat)

### Example 2: Download Only .dat.gz Files

```
[MBS Retrieve Backup]
├─ Company Code: CO655
├─ Base Path: /fromcdg/backup/
└─ File Pattern: *.dat.gz
```

**Output**: Only compressed data files, excluding toc.dat

### Example 3: Complete Backup Pipeline

```
[Schedule Trigger (Daily 2 AM)]
  ↓
[MBS Retrieve Backup]
  ↓
[AWS S3 (Upload Multiple Files)]
  ↓
[Slack Notification (Success/Failure)]
```

## Node Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| **Host** | String | Yes | `={{$json.host}}` | SFTP server hostname |
| **Port** | Number | Yes | `22` | SFTP server port |
| **Username** | String | Yes | `={{$json.username}}` | SFTP username (supports expressions) |
| **Password** | String | Yes | `={{$json.password}}` | SFTP password (supports expressions) |
| **Company Code** | String | Yes | - | Company identifier (e.g., CO655 for Archtop) |
| **Base Path** | String | Yes | `/fromcdg/backup/` | Base directory on SFTP server |
| **File Pattern** | String | No | `*` | File pattern to match (supports * wildcard) |
| **Binary Property Name** | String | Yes | `data` | Property name for binary file data |

## Output Format

Each downloaded file produces one item:

```json
{
  "json": {
    "fileName": "3591.dat.gz",
    "filePath": "/fromcdg/backup/CO655-2024-01-15-14-30-45/3591.dat.gz",
    "fileSize": 245678,
    "backupFolder": "CO655-2024-01-15-14-30-45",
    "companyCode": "CO655",
    "modifyTime": 1705330245000
  },
  "binary": {
    "data": {
      "data": "...", // File contents as Buffer
      "fileName": "3591.dat.gz",
      "mimeType": "application/gzip"
    }
  }
}
```

## MBS Backup Structure

MBS creates backup folders with this naming pattern:
```
/fromcdg/backup/
└── CO655-2024-01-15-14-30-45/  (Company code + timestamp)
    ├── 3591.dat.gz
    ├── 3592.dat.gz
    ├── ... (1,079+ files)
    └── toc.dat
```

**Important**: MBS only keeps ONE backup at a time. Old backups are deleted when new ones are created.

## Dynamic Credentials

This node accepts SFTP credentials as parameters, making it perfect for dynamic credential flows:

**From AWS Secrets Manager:**
```
[AWS Secrets Manager] → [MBS Retrieve Backup]
  - Host: ={{$json.host}}
  - Username: ={{$json.username}}
  - Password: ={{$json.password}}
```

**From any previous node:**
The node accepts expressions for all credential fields, so you can retrieve credentials from:
- AWS Secrets Manager
- Environment variables
- Configuration nodes
- API responses
- Any other n8n node output

## Common Use Cases

### 1. Daily Backup to S3

Download MBS backups daily and upload to AWS S3 for long-term storage:

```
Schedule → MBS Retrieve Backup → AWS S3 Upload → Slack Notification
```

### 2. Dynamic Credentials from AWS Secrets

Retrieve SFTP credentials from AWS Secrets Manager:

```
AWS Secrets Manager → MBS Retrieve Backup → Process Files
```

### 3. Backup Verification

Download backups and verify file counts/sizes:

```
MBS Retrieve Backup → Code Node (Count Files) → Conditional (Alert if < Expected)
```

## Troubleshooting

### Node not appearing after installation

```bash
# Check if package is installed
npm list -g | grep mbs-backup

# Check n8n logs
docker logs <n8n-container-name>

# Force restart
docker restart <n8n-container-name>
```

### Connection timeout

- Verify SFTP credentials are correct
- Check firewall rules allow outbound port 22
- Ensure VPN is connected if required

### No backup folder found

- Verify company code is correct (case-sensitive)
- Check base path exists on SFTP server
- Confirm MBS has created a backup today

### Out of memory during download

For very large backups (>1000 files):
- Download files in batches using file pattern
- Process files immediately after download
- Use streaming for large file uploads to S3

## Development

```bash
# Clone repository
git clone https://github.com/manateeit/n8n-nodes-mbs-backup.git
cd n8n-nodes-mbs-backup

# Install dependencies
npm install

# Build
npm run build

# Watch mode for development
npm run dev
```

## License

MIT

## Support

- **Issues**: https://github.com/manateeit/n8n-nodes-mbs-backup/issues
- **n8n Community**: https://community.n8n.io

## Related Nodes

- [n8n-nodes-aws-secrets](https://www.npmjs.com/package/n8n-nodes-aws-secrets) - Retrieve SFTP credentials from AWS Secrets Manager
- [n8n AWS S3 Node](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.awss3/) - Upload backup files to S3

## Credits

Created by [Archtop](https://archtop.com) for MBS backup automation.
