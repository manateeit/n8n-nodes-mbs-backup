# Quick Start Guide

Get the MBS Retrieve Backup node running in n8n in under 5 minutes.

## Step 1: Install the Node

### Option A: Via n8n Community Nodes UI (Easiest)

1. Access your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Click **Install a Community Node**
4. Enter: `n8n-nodes-mbs-backup`
5. Click **Install**
6. Wait for installation to complete (~30 seconds)

### Option B: Via npm (Docker Installations)

```bash
# SSH to your server
ssh user@your-server

# Install in n8n container
docker exec -it n8n-container-name npm install -g n8n-nodes-mbs-backup

# Restart n8n
docker restart n8n-container-name
```

## Step 2: Create SFTP Credentials

1. In n8n, go to **Credentials** → **New**
2. Search for **"SFTP API"**
3. Fill in your MBS SFTP details:

```
Host: transfer.cdg.ws
Port: 22
Username: your-sftp-username
Password: your-sftp-password
```

4. Click **Save**

## Step 3: Create Your First Workflow

### Simple Daily Backup to S3

1. **Add Schedule Trigger**
   - Trigger: Every day at 2:00 AM

2. **Add MBS Retrieve Backup Node**
   - Company Code: `CO655` (your company code)
   - Base Path: `/fromcdg/backup/`
   - File Pattern: `*` (all files)

3. **Add AWS S3 Node**
   - Operation: Upload
   - Bucket: `your-backup-bucket`
   - File Name: `={{$json.fileName}}`
   - Binary Data: Yes
   - Binary Property: `data`

4. **Add Slack Node** (optional)
   - Message: `Backup completed: {{$json.fileCount}} files downloaded`

5. Click **Execute Workflow** to test

## Step 4: Verify It's Working

After execution, you should see:
- ✅ Multiple items in the output (one per file)
- ✅ Each item has `fileName`, `filePath`, `fileSize`
- ✅ Binary data attached to each item
- ✅ Files uploaded to S3

## Common Configurations

### Configuration 1: Multiple Company Codes

If you manage backups for multiple MBS customers:

```
[Schedule Trigger]
  ↓
[Set Company Codes] (Code node: return [{json: {code: 'CO655'}}, {json: {code: 'CO123'}}])
  ↓
[MBS Retrieve Backup]
  - Company Code: ={{$json.code}}
  ↓
[AWS S3 Upload]
  - Folder: ={{$json.companyCode}}/{{$now.format('yyyy-MM-dd')}}/
```

### Configuration 2: Dynamic Credentials from AWS Secrets

```
[Schedule Trigger]
  ↓
[AWS Secrets Manager]
  - Secret Name: mbs/sftp/credentials
  - Parse JSON: Yes
  ↓
[MBS Retrieve Backup]
  - Use dynamic credentials from previous node
  ↓
[Process Files]
```

### Configuration 3: Download Only Specific Files

```
[MBS Retrieve Backup]
  - Company Code: CO655
  - Base Path: /fromcdg/backup/
  - File Pattern: *.dat.gz  (exclude toc.dat)
```

## Troubleshooting

### Issue: Node not showing in search

**Solution**:
```bash
# Verify installation
npm list -g | grep mbs-backup

# If not installed, reinstall
npm uninstall -g n8n-nodes-mbs-backup
npm install -g n8n-nodes-mbs-backup

# Restart n8n
docker restart n8n-container-name
```

### Issue: "No backup folder found"

**Possible causes**:
1. ❌ Wrong company code (check case-sensitivity: `CO655` not `co655`)
2. ❌ MBS hasn't created backup yet today
3. ❌ Base path incorrect (`/fromcdg/backup/` not `/backup/`)

**Debug**:
- Check SFTP server manually with FileZilla/WinSCP
- Verify folder exists: `CO655-YYYY-MM-DD-HH-MM-SS`

### Issue: Connection timeout

**Possible causes**:
1. ❌ Firewall blocking port 22
2. ❌ VPN not connected
3. ❌ Wrong SFTP credentials

**Solution**:
- Test SFTP connection with FileZilla first
- Verify firewall allows outbound port 22
- Check credentials are correct

### Issue: Out of memory downloading files

**Solution** (for large backups with 1000+ files):
```
Option A: Download in batches
  - File Pattern: 359*.dat.gz (batch 1)
  - File Pattern: 360*.dat.gz (batch 2)

Option B: Process immediately
  [MBS Retrieve] → [AWS S3 Upload] → [Delete from memory]
```

## Next Steps

1. ✅ Set up daily schedule for automatic backups
2. ✅ Configure S3 lifecycle policies for long-term storage
3. ✅ Add error notifications to Slack/Email
4. ✅ Create backup verification workflow
5. ✅ Document your backup retention policy

## Example Workflows

### Complete Production Backup Pipeline

```
[Schedule: Daily 2 AM]
  ↓
[AWS Secrets Manager] (Get SFTP credentials)
  ↓
[MBS Retrieve Backup] (Download all files)
  ↓
[AWS S3 Upload] (Upload to s3://backups/mbs/{{date}}/{{fileName}})
  ↓
[Code Node] (Count files, calculate total size)
  ↓
[Conditional] (If files < expected, alert)
  ├─ True → [Slack: Alert backup incomplete]
  └─ False → [Slack: Backup successful]
```

### Backup with Verification

```
[MBS Retrieve Backup]
  ↓
[AWS S3 Upload]
  ↓
[AWS S3 Get] (Download same file to verify)
  ↓
[Code Node] (Compare checksums)
  ↓
[Slack: Report verification result]
```

## Need Help?

- 📖 Full Documentation: [README.md](README.md)
- 🐛 Report Issues: https://github.com/manateeit/n8n-nodes-mbs-backup/issues
- 💬 n8n Community: https://community.n8n.io

## Quick Reference

**SFTP Server**: `transfer.cdg.ws:22`
**Backup Path**: `/fromcdg/backup/CO655-YYYY-MM-DD-HH-MM-SS/`
**File Count**: ~1,079 .dat.gz files + 1 toc.dat
**Backup Frequency**: Daily (MBS deletes old, creates new)
**Company Code Format**: `CO###` (e.g., CO655 for Archtop)
