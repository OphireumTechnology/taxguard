@echo off
setlocal EnableExtensions
cd /d C:\Users\USER\Documents\GitHub\123

echo ============================================================
echo TAXGUARD M7 REMAINING DEVELOPMENT MASTER BUILD
echo ============================================================

call :run m7-5
if errorlevel 1 exit /b 1
call :run m7-6
if errorlevel 1 exit /b 1
call :run m7-7
if errorlevel 1 exit /b 1
call :run m7-8
if errorlevel 1 exit /b 1
call :run m7-9
if errorlevel 1 exit /b 1
call :run m7-10
if errorlevel 1 exit /b 1
call :run m7-11
if errorlevel 1 exit /b 1
call :run m7-12
if errorlevel 1 exit /b 1
call :run m7-13
if errorlevel 1 exit /b 1

echo ============================================================
echo TAXGUARD M7 VERIFIED PASS
echo M7.1-M7.13 COMPLETE
echo ============================================================
exit /b 0

:run
set STEP=%1
set SCRIPT=tools\taxguard-%STEP%-build.mjs

echo.
echo ============================================================
echo RUNNING %STEP%
echo ============================================================
if not exist "%SCRIPT%" (
 echo STOPPED: %SCRIPT% does not exist.
 echo No source files were changed by this master runner.
 exit /b 1
)
node --check "%SCRIPT%"
if errorlevel 1 (
 echo STOPPED: %STEP% builder has a JavaScript syntax error.
 exit /b 1
)
node "%SCRIPT%"
if errorlevel 1 (
 echo STOPPED: %STEP% failed.
 exit /b 1
)
exit /b 0