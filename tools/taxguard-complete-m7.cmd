@echo off
setlocal EnableExtensions
cd /d C:\Users\USER\Documents\GitHub\123

echo ============================================================
echo TAXGUARD CONTROLLED COMPLETION BUILD - M7.5 THROUGH M7.13
echo ============================================================
echo PRESERVE: M1-M7.4
echo FAIL CLOSED: YES
echo EXTERNAL TAX SUBMISSION: DISABLED
echo.
call :baseline
if errorlevel 1 goto FAIL
call :milestone m7-5
if errorlevel 1 goto FAIL
call :milestone m7-6
if errorlevel 1 goto FAIL
call :milestone m7-7
if errorlevel 1 goto FAIL
call :milestone m7-8
if errorlevel 1 goto FAIL
call :milestone m7-9
if errorlevel 1 goto FAIL
call :milestone m7-10
if errorlevel 1 goto FAIL
call :milestone m7-11
if errorlevel 1 goto FAIL
call :milestone m7-12
if errorlevel 1 goto FAIL
call :milestone m7-13
if errorlevel 1 goto FAIL
echo.
echo ============================================================
echo TAXGUARD M7 COMPLETE - VERIFIED PASS
echo ============================================================
echo M7.5-M7.13 completed through validated builders.
echo Full regression PASS
echo Production build PASS
echo TypeScript PASS
exit /b 0

:baseline
echo.
echo ===== BASELINE TYPESCRIPT =====
call npm.cmd run typecheck
if errorlevel 1 exit /b 1
echo ===== BASELINE ACTIVE REGRESSION =====
call npm.cmd test -- --run
if errorlevel 1 exit /b 1
echo ===== BASELINE PRODUCTION BUILD =====
call npm.cmd run build
if errorlevel 1 exit /b 1
echo ===== BASELINE FINAL TYPESCRIPT =====
call npm.cmd run typecheck
if errorlevel 1 exit /b 1
exit /b 0

:milestone
set STEP=%1
set SCRIPT=tools\taxguard-%STEP%-build.mjs
echo.
echo ============================================================
echo BUILDING %STEP%
echo ============================================================
if not exist "%SCRIPT%" (
 echo REQUIRED BUILDER MISSING: %SCRIPT%
 echo STOPPED SAFELY BEFORE %STEP%
 exit /b 1
)
echo Checking builder syntax...
node --check "%SCRIPT%"
if errorlevel 1 (
 echo BUILDER SYNTAX FAILED: %SCRIPT%
 exit /b 1
)
echo Executing %STEP%...
node "%SCRIPT%"
if errorlevel 1 (
 echo MILESTONE FAILED: %STEP%
 exit /b 1
)
echo Validating entire system after %STEP%...
call npm.cmd run typecheck
if errorlevel 1 exit /b 1
call npm.cmd test -- --run
if errorlevel 1 exit /b 1
call npm.cmd run build
if errorlevel 1 exit /b 1
call npm.cmd run typecheck
if errorlevel 1 exit /b 1
echo VERIFIED: %STEP%
exit /b 0

:FAIL
echo.
echo ============================================================
echo TAXGUARD BUILD STOPPED SAFELY
echo ============================================================
echo A builder or validation gate failed.
echo No false PASS was produced.
echo Preserve the failure output and repair that specific defect.
exit /b 1