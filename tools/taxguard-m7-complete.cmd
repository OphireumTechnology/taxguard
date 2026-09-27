@echo off
setlocal EnableExtensions
cd /d C:\Users\USER\Documents\GitHub\123

echo ============================================================
echo TAXGUARD M7 COMPLETE DEVELOPMENT BUILD
echo M7.5 THROUGH M7.13
echo ============================================================
echo.
echo Frozen: M1-M7.4
echo External submission: DISABLED
echo Fail-closed validation: ENABLED
echo.
call :validate BASELINE
if errorlevel 1 goto FAIL
call :run m7-5
if errorlevel 1 goto FAIL
call :run m7-6
if errorlevel 1 goto FAIL
call :run m7-7
if errorlevel 1 goto FAIL
call :run m7-8
if errorlevel 1 goto FAIL
call :run m7-9
if errorlevel 1 goto FAIL
call :run m7-10
if errorlevel 1 goto FAIL
call :run m7-11
if errorlevel 1 goto FAIL
call :run m7-12
if errorlevel 1 goto FAIL
call :run m7-13
if errorlevel 1 goto FAIL
echo.
echo ============================================================
echo TAXGUARD M7 COMPLETE - VERIFIED PASS
echo ============================================================
exit /b 0

:run
set STEP=%1
set SCRIPT=tools\taxguard-%STEP%-build.mjs
echo.
echo ============================================================
echo BUILDING %STEP%
echo ============================================================
if not exist "%SCRIPT%" (
 echo STOPPED: Missing %SCRIPT%
 exit /b 1
)
node --check "%SCRIPT%"
if errorlevel 1 (
 echo STOPPED: JavaScript syntax failure in %SCRIPT%
 exit /b 1
)
node "%SCRIPT%"
if errorlevel 1 (
 echo STOPPED: %STEP% implementation failed
 exit /b 1
)
call :validate %STEP%
if errorlevel 1 exit /b 1
echo VERIFIED: %STEP%
exit /b 0

:validate
echo.
echo VALIDATING %1
call npm.cmd run typecheck
if errorlevel 1 exit /b 1
call npm.cmd test -- --run
if errorlevel 1 exit /b 1
call npm.cmd run build
if errorlevel 1 exit /b 1
call npm.cmd run typecheck
if errorlevel 1 exit /b 1
echo PASS: %1
exit /b 0

:FAIL
echo.
echo ============================================================
echo TAXGUARD BUILD STOPPED SAFELY
echo ============================================================
echo A real implementation or regression failure was detected.
echo Frozen milestones remain protected.
echo No false PASS status produced.
exit /b 1