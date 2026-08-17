$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $projectRoot "DS-PROJECT-QC-CODE-AND-FLOWS.txt"

$sourceFiles = @(
  "README-SETUP-PTBR.md",
  "app/page.tsx",
  "app/ProjectsWorkspace.tsx",
  "app/ReportsWorkspace.tsx",
  "app/layout.tsx",
  "app/globals.css",
  "app/chatgpt-auth.ts",
  "app/api/projects/route.ts",
  "app/api/project-events/route.ts",
  "app/api/reports/route.ts",
  "db/index.ts",
  "db/schema.ts",
  "worker/index.ts",
  "drizzle/0000_clean_ben_urich.sql",
  "drizzle.config.ts",
  "vite.config.ts",
  "next.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "tsconfig.json",
  "package.json",
  "tests/rendered-html.test.mjs"
)

$header = @'
DS PROJECT QC — CODE AND FUNCTIONAL FLOWS EXPORT
Export date: 08/14/2026 (MM/DD/YYYY)

PURPOSE
This document is a readable backup of the application logic and source code.
It contains no passwords, API keys, repository credentials, dependency folders,
compiled output, generated images, uploaded project PDFs, or hosting identifiers.

======================================================================
PART 1 — PRODUCT AND FUNCTIONAL FLOWS
======================================================================

1. MAIN PROJECT PACKAGE QC FLOW

  Create/select project
    -> Upload Project Package PDF and identify its origin:
       Project Package — Revit / Project Package — AutoCAD / Shop Drawings
    -> Analyze every sheet
    -> Cross-check Index, Original, Demolition, Proposed, Construction,
       RCP, Ceiling, Lighting, Circuits, schedules, tags and revision history
    -> Classify results:
       WHAT MATCHES / HIGH-CONFIDENCE ERROR / MEDIUM-CONFIDENCE CHECK /
       MINOR BUT RECORDED
    -> Convert findings into correction tasks
    -> Team marks each task CORRECTED or NON APPLICABLE
    -> NON APPLICABLE requires a written explanation and may become a reusable rule
    -> Team may add a manual correction missed by the system
    -> Upload corrected PDF revision
    -> Run a new QC check and compare with the preceding revision
    -> Repeat until all objective checks are resolved
    -> Ask whether to generate/update the Material List for supplier pricing

2. FINDING / TASK FLOW

  Each finding must contain:
    - Unique number
    - Confidence level
    - Evidence type
    - Exact location: page, sheet number, plan/schedule/legend/detail and room/item
    - What was found
    - Expected condition or exact correction instruction
    - Code section and official source when the issue is regulatory
    - Status: PENDING / CORRECTED / NON APPLICABLE

  Clicking any summary window, coverage group, comparison row or marker must open
  and focus the corresponding finding.

3. REGULATORY FINDING FLOW

  Detect possible code issue
    -> Identify project jurisdiction and adopted code edition
    -> Research the official code/AHJ source
    -> Compare the exact drawing condition against the requirement
    -> If confirmed, show "STANDARD VERIFIED" and provide:
       exact section + plan evidence + concrete correction recommendation
    -> If resolution or scope prevents confirmation, keep medium confidence and
       explicitly state what information is missing
    -> Final permit compliance remains subject to the licensed professional and AHJ

4. PROJECT AND TIMELINE FLOW [IMPLEMENTED]

  Authorized @ds-miami.com user
    -> Create a project
    -> Project receives its own persistent timeline
    -> Add Project Package, Shop Drawings, Material List, Budget/RFQ,
       correction, meeting/decision or other event
    -> Store revision, status, notes, creator email and timestamp
    -> Display all events in chronological project history

5. ACCESS FLOW [IMPLEMENTED]

  Public visitor
    -> Can view the QC demonstration screen

  Signed-in @ds-miami.com user
    -> Can access projects and timelines and register activity

  Admin account
    -> Can access the consolidated activity report

6. ADMIN REPORT FLOW [IMPLEMENTED]

  Admin opens Reports
    -> See number of projects, uploads, corrections and contributors
    -> Filter by project, activity type and person
    -> Review who uploaded what and which corrections were requested
    -> Export filtered data as Excel-compatible CSV

7. DESIGN REVISION COMPARISON [UI MODEL / FUTURE ENGINE]

  Select two revisions, for example R03 and R04
    -> Compare design information rather than only technical errors
    -> Report category, room, prior value, current value and quantity/area
    -> Example: Wall Treatment / Gym / Wallpaper -> Limewash / 245 SQFT
    -> Flag effects on the Material List and supplier pricing

8. MATERIAL LIST FLOW [FUTURE]

  All Project Package QC checks confirmed
    -> Ask whether to generate Material List
    -> Extract specifications and verified quantities
    -> Generate Excel/open-format file using the DS standard
    -> When a new revision is uploaded, ask whether to update the Material List
    -> Recalculate changed quantities and prepare supplier budget update

9. CURRENT IMPLEMENTATION STATUS

  IMPLEMENTED
    - Interactive QC demonstration and correction-task states
    - Clickable coverage groups and result counters
    - CORRECTED and NON APPLICABLE interactions
    - Manual finding input
    - Project creation and persistent project timeline
    - DS-domain access restriction
    - Admin activity report and CSV export
    - Revision-comparison interface model

  PARTIAL
    - Findings and drawing evidence shown in the QC screen are currently seeded
      in the frontend for the CASA@63 example
    - PDF upload control currently records the selected filename in the UI
    - Some user actions are local React state and reset after page reload

  FUTURE / NOT YET CONNECTED
    - Real PDF ingestion, page rendering, OCR and vector/text extraction
    - Automatic rule engine and cross-sheet comparison
    - Persistent findings, corrections, Non Applicable reasons and learned rules
    - Drawing marker coordinates and attached image crops
    - Real revision-to-revision design change detection
    - Automatic Material List generation and quantity updates
    - Supplier RFQ/budget synchronization

10. PRIMARY DATA MODEL

  projects
    id, name, code, project_type, status,
    created_by, created_by_email, created_at, updated_at

  project_events
    id, project_id, document_type, title, revision, status, notes,
    created_by, created_by_email, created_at

  Required future tables:
    findings, finding_comments, finding_evidence, qc_rules,
    rule_exceptions, known_cases, document_revisions, material_lists

======================================================================
PART 2 — SOURCE CODE
======================================================================

The source is reproduced below, separated by file. Generated dependencies,
lockfiles, build artifacts and private deployment metadata are intentionally omitted.
'@

$builder = [System.Text.StringBuilder]::new()
[void]$builder.AppendLine($header.Trim())

foreach ($relativePath in $sourceFiles) {
  $absolutePath = Join-Path $projectRoot $relativePath
  if (-not (Test-Path -LiteralPath $absolutePath)) {
    continue
  }

  [void]$builder.AppendLine()
  [void]$builder.AppendLine("======================================================================")
  [void]$builder.AppendLine("FILE: $relativePath")
  [void]$builder.AppendLine("======================================================================")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine((Get-Content -Raw -LiteralPath $absolutePath).TrimEnd())
}

[void]$builder.AppendLine()
[void]$builder.AppendLine("======================================================================")
[void]$builder.AppendLine("END OF EXPORT")
[void]$builder.AppendLine("======================================================================")

[System.IO.File]::WriteAllText(
  $outputPath,
  $builder.ToString(),
  [System.Text.UTF8Encoding]::new($true)
)

Write-Output $outputPath
