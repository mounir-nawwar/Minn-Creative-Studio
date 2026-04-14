@echo off
echo Running Jest tests with coverage...
echo.

:: Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies first...
    npm install
    echo.
)

:: Run tests with coverage
node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage

:: Check if tests passed
if %errorlevel% equ 0 (
    echo.
    echo =====================================
    echo ✓ All tests passed!
    echo =====================================
) else (
    echo.
    echo =====================================
    echo ✗ Tests failed
    echo =====================================
)

echo.
pause
