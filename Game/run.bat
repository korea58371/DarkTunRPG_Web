@echo off
setlocal
REM 항상 이 배치파일이 있는 Game 폴더에서 실행되도록 디렉터리 이동(UNC 경로 지원: pushd가 임시 드라이브 매핑)
pushd "%~dp0"

set PORT=5500
set URL=http://localhost:%PORT%/

REM standalone 번들이 있으면 그쪽으로, 없으면 index.html로 열기
if exist "standalone\app.bundle.js" (
  set START_PAGE=%URL%index-standalone.html
) else (
  set START_PAGE=%URL%index.html
)

echo Starting local server on %URL%

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  REM 서버를 먼저 백그라운드로 띄운 후 브라우저 오픈(레이스 컨디션 회피)
  start "" /D "%CD%" python -m http.server %PORT%
  REM 짧은 대기(약 1초)
  powershell -command "Start-Sleep -Milliseconds 900" 2>nul || ping -n 2 127.0.0.1 >nul
  start "" %START_PAGE%
  popd
  goto :eof
)

where node >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" /D "%CD%" npx http-server -p %PORT% -c-1 .
  powershell -command "Start-Sleep -Milliseconds 900" 2>nul || ping -n 2 127.0.0.1 >nul
  start "" %START_PAGE%
  popd
  goto :eof
)

echo [!] Python 또는 Node.js가 설치되어 있지 않습니다.
echo     https://www.python.org/ 또는 https://nodejs.org/ 에서 설치 후 다시 실행하세요.
pause


