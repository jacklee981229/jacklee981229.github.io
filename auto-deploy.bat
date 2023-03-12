cd /D "%~dp0"
del deploy.log
rmdir ".deploy_git" /s /q
hexo g -d >> deploy.log
if errorlevel 1 (
  echo Error encountered during deployment!
  start deploy.log
  exit /b 1
)

pause