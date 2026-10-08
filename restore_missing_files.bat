@echo off
setlocal
cd /d "%~dp0"
python "%~dp0restore_missing_files.py"
set "recovery_exit=%ERRORLEVEL%"
if not "%recovery_exit%"=="0" echo Recovery reported an error. Please check the messages above.
pause
exit /b %recovery_exit%
