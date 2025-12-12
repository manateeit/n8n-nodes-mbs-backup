# Batch Processing Workflow Example

Process large MBS backups in batches to avoid memory issues and timeout.

## Simple Loop Workflow

```
[Schedule Trigger - Daily 2 AM]
  ↓
[Set Variable: offset = 0]
  ↓
[Loop Node]
  ├─ [AWS Secrets Manager]
  │    Secret Name: mbs/sftp/credentials
  │    Parse JSON: Yes
  │    ↓
  ├─ [MBS Retrieve Backup]
  │    Host: ={{$json.host}}
  │    Username: ={{$json.username}}
  │    Password: ={{$json.password}}
  │    Company Code: CO655
  │    Base Path: /fromcdg/backup/
  │    Batch Size (Limit): 50        ← Download 50 files per iteration
  │    Offset: ={{$node["Set Variable"].json["offset"]}}
  │    ↓
  ├─ [AWS S3 Upload]
  │    Bucket: your-backup-bucket
  │    File Name: mbs/{{$now.format('yyyy-MM-dd')}}/{{$json.fileName}}
  │    Binary Data: Yes
  │    ↓
  ├─ [If Node - Check hasMoreFiles]
  │    Condition: {{$json.hasMoreFiles}} = true
  │    ↓
  │    ├─ TRUE → [Set Variable: offset = {{$json.nextOffset}}] → Loop back
  │    └─ FALSE → [Slack: Backup Complete]
```

## Code Node Approach (More Control)

Use a Code node to handle the loop:

```javascript
// Initialize on first run
let offset = $input.first()?.json?.nextOffset || 0;
let allFilesProcessed = [];

// Loop configuration
const batchSize = 50;
const maxIterations = 100; // Safety limit

for (let iteration = 0; iteration < maxIterations; iteration++) {
  // Call MBS Retrieve Backup node with current offset
  const batchResults = await $executeWorkflow(
    'MBS Backup Batch',
    {
      offset: offset,
      limit: batchSize
    }
  );

  // Process results
  allFilesProcessed.push(...batchResults);

  // Check if there are more files
  const lastItem = batchResults[batchResults.length - 1];
  if (!lastItem?.json?.hasMoreFiles) {
    break; // No more files, exit loop
  }

  // Move to next batch
  offset = lastItem.json.nextOffset;
}

return allFilesProcessed;
```

## Output Fields for Batching

Each downloaded file includes these fields:

```json
{
  "fileName": "3591.dat.gz",
  "batchOffset": 0,
  "batchLimit": 50,
  "batchFileIndex": 0,
  "batchFileCount": 50,
  "hasMoreFiles": true,
  "nextOffset": 50
}
```

## Recommended Batch Sizes

| Total Files | Batch Size | Iterations | Approx Time |
|-------------|------------|------------|-------------|
| 1,079 files | 50 | 22 | ~20 minutes |
| 1,079 files | 100 | 11 | ~15 minutes |
| 1,079 files | 200 | 6 | ~12 minutes |

## Error Handling

Add error handling between batches:

```
[MBS Retrieve Backup]
  ↓
[If Node - Check for errors]
  ├─ ERROR → [Slack: Alert + Retry]
  └─ SUCCESS → Continue to S3
```

## Progress Tracking

Track progress with a counter:

```javascript
// In Code node
const totalFiles = 1079; // Or get from first batch
const processed = $json.batchOffset + $json.batchFileCount;
const percentComplete = Math.round((processed / totalFiles) * 100);

return [{
  json: {
    ...inputData,
    progress: `${processed}/${totalFiles} files (${percentComplete}%)`
  }
}];
```
