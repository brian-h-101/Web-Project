EXODUS WORKFLOW IN VISUAL STUDIO CODE

Drag an entry .ps1 file into VS Code's PowerShell terminal. Use & before the
quoted path, append parameters, then press Enter. Scripts find the project
using $PSScriptRoot; your terminal can remain in any directory.

PRIMARY: BUILD, UPLOAD, AND DEPLOY
  Primary/Frontend/build.ps1                 Build React into Frontend/dist
  Primary/Frontend/update.ps1                Upload the existing dist contents to S3
  Primary/Lambda/update.ps1                  Package and deploy Python changes
  Primary/CloudFront/update.ps1              Apply a reviewed distribution plan
  Primary/CloudFront/publish-frontend-router.ps1  Publish the tested router to LIVE

For example, preview and then run the local React build:
  & "C:\Users\brian\Documents\Scripts\demo\Web-Project\Tools\Primary\Frontend\build.ps1" -WhatIf
  & "C:\Users\brian\Documents\Scripts\demo\Web-Project\Tools\Primary\Frontend\build.ps1"

After checking the build locally, preview and then upload it:
  & "C:\Users\brian\Documents\Scripts\demo\Web-Project\Tools\Primary\Frontend\update.ps1" -WhatIf
  & "C:\Users\brian\Documents\Scripts\demo\Web-Project\Tools\Primary\Frontend\update.ps1"

Build and upload are separate steps. Upload uses only Website/Frontend/dist,
skips symbolic links, and does not delete existing S3 objects.

SECONDARY: SETUP, LOGIN, VERIFICATION, AND HELPERS
  Secondary/Login/aws-login.ps1              Renew the Exodus login
  Secondary/Login/aws-verify.ps1             Verify account and profile
  Secondary/IAM/create-greeting-role.ps1     Create/reuse the Lambda execution role
  Secondary/Lambda/create.ps1                Create/reuse the Lambda function
  Secondary/Lambda/package.ps1               Package the Python handler locally
  Secondary/Lambda/invoke.ps1                Invoke Lambda with a saved event
  Secondary/HTTP-API-Endpoint/create.ps1      Create/reuse the HTTP API components
  Secondary/HTTP-API-Endpoint/test.ps1        Test greeting; append -Name Brian
                                            Add -ThroughWebsite to use CloudFront
  Secondary/CloudFront/get-config.ps1        Save the current distribution config
                                            Add -PrepareUpdate to prepare a plan
  Secondary/CloudFront/create-frontend-router.ps1  Create the DEVELOPMENT router
  Secondary/CloudFront/test-frontend-router.ps1    Test the DEVELOPMENT router
  Secondary/Budgets/create.ps1               Create/verify the monthly budget
                                            For initial setup: -Email your-address@example.com
  Secondary/Tests/offline.ps1                Run isolated checks with local fakes
  Secondary/Shared                          Helpers loaded by entry scripts
  Secondary/Powershell-policy/sec-fix.ps1    Existing manual policy helper
  Secondary/run.ps1                         Optional task dispatcher

Run entry scripts directly for the normal workflow. Shared files and
Tests/Fakes.ps1 are supporting code, not entry scripts. The policy helper is
manual; no other script runs it or changes your execution policy.

CONFIGURATION AND GENERATED FILES
  Website/Systems/Configuration/project.json  Profile, account, names, and paths
  Website/Frontend/src                       React source code
  Website/Frontend/dist                      Built browser files uploaded to S3
  Website/Backend/Lambda/Greeting             Python handler source
  Website/Backend/CloudFront                  Frontend router source
  Website/Systems/CloudFront/Snapshots         Retrieved distribution configs and ETags
  Website/Systems/CloudFront/Updates           Editable plans and update requests
  Website/Systems/CloudFront/Functions         Router config, events, and test results
  Website/Systems/APIGateway                  Saved HTTP API details
  Website/Systems/IAM                         Role trust policies
  Website/Systems/S3                          Bucket policies
  Website/Systems/Lambda/Events                Inputs for direct Lambda invocation
  Website/Systems/Lambda/Responses             Returned Lambda payloads
  Website/Systems/Lambda/Packages              Generated deployment ZIPs
  Website/Systems/Route53/exodus-acm-validation.json
  Website/Systems/Budgets/exodus-monthly-budget-request.json

The two exodus-*.json files preserve your original setup requests. The budget
script also saves its own monthly-budget-request.json when it runs.

DEPLOYMENT WORKFLOWS
For Python changes, run the handler locally, then Primary/Lambda/update.ps1
with -WhatIf. Deploy without -WhatIf, then use Secondary/Lambda/invoke.ps1 and
Secondary/HTTP-API-Endpoint/test.ps1 -Name Brian to verify the result.

For distribution changes, Secondary/CloudFront/get-config.ps1 -PrepareUpdate
creates an editable Updates/cloudfront-update.json containing the complete
DistributionConfig and its ETag. An existing plan is preserved. Review the
plan, then use Primary/CloudFront/update.ps1. A stale ETag blocks the update.
The scripts do not automatically add routes or attach CloudFront functions.
Your deployed /api/* behavior and frontend page rewrite are already configured.

For router publication, create/test in Secondary/CloudFront, then publish in
Primary/CloudFront. Publication requires a passing test for the current ETag.
Publishing alone does not attach a function to the distribution.

WHATIF AND ERRORS
Entry scripts above for build, AWS operations, and HTTP tests accept -WhatIf
and return before npm, AWS, or HTTP calls. Offline tests are run directly.
WhatIf describes the action; it does not retrieve an AWS configuration diff.
AWS operations verify account 384635610196. Expired login, denied access,
conflicts, and ambiguous APIs stop the operation. Lambda invocation checks
FunctionError as well as the CLI exit code. HTTP publication retries are bounded.

FOLLOWING THE CODE
Selected entry script -> Secondary/Shared/Project.ps1 -> project.json.
Entry scripts show the sequence. Shared helpers handle repeated operations:
Aws.ps1 runs the CLI and parses JSON; HttpApi.ps1 connects returned resource IDs;
Http.ps1 validates greeting responses and handles brief publication retries.

OFFLINE VALIDATION
  & "C:\Users\brian\Documents\Scripts\demo\Web-Project\Tools\Secondary\Tests\offline.ps1"
The test entry script starts a child PowerShell process, copies fixtures to a
temporary project, and replaces AWS, HTTP, npm, and sleep commands with fakes.
It checks syntax, paths, WhatIf, build success/failure, deployment workflows,
router tests/publication, and conflict handling without contacting AWS.