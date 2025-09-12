#!/bin/bash

# Python Security Analysis Script
set -euo pipefail

WORKSPACE_DIR="/workspace"
OUTPUT_DIR="/workspace/analysis-output"
LOG_FILE="$OUTPUT_DIR/analysis.log"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting Python security analysis..."

# Check for requirements files
REQUIREMENTS_FILES=("requirements.txt" "requirements-dev.txt" "setup.py" "pyproject.toml" "Pipfile")
FOUND_REQ_FILE=""

for req_file in "${REQUIREMENTS_FILES[@]}"; do
    if [[ -f "$WORKSPACE_DIR/$req_file" ]]; then
        FOUND_REQ_FILE="$req_file"
        log "Found requirements file: $req_file"
        break
    fi
done

if [[ -z "$FOUND_REQ_FILE" ]]; then
    log "WARNING: No requirements file found"
fi

# Parse requirements
log "Parsing dependencies..."
{
    echo "=== PYTHON DEPENDENCIES ==="
    
    if [[ -f "$WORKSPACE_DIR/requirements.txt" ]]; then
        echo "From requirements.txt:"
        grep -v '^#' "$WORKSPACE_DIR/requirements.txt" | grep -v '^$' || echo "No dependencies found"
    fi
    
    if [[ -f "$WORKSPACE_DIR/setup.py" ]]; then
        echo ""
        echo "From setup.py:"
        grep -A 20 "install_requires" "$WORKSPACE_DIR/setup.py" | grep -E "^\s*['\"]" || echo "No install_requires found"
    fi
    
    if [[ -f "$WORKSPACE_DIR/pyproject.toml" ]]; then
        echo ""
        echo "From pyproject.toml:"
        grep -A 10 "\[tool.poetry.dependencies\]" "$WORKSPACE_DIR/pyproject.toml" || echo "No poetry dependencies found"
    fi
    
} > "$OUTPUT_DIR/dependencies.txt"

# Check for suspicious patterns
log "Checking for suspicious patterns..."
{
    echo "=== SUSPICIOUS PATTERNS CHECK ==="
    
    # Check for dangerous imports
    DANGEROUS_IMPORTS=("os.system" "subprocess" "eval" "exec" "compile" "__import__" "importlib")
    
    echo "Dangerous imports check:"
    for import_pattern in "${DANGEROUS_IMPORTS[@]}"; do
        if find "$WORKSPACE_DIR" -name "*.py" -type f -exec grep -l "$import_pattern" {} \; 2>/dev/null | head -3; then
            echo "WARNING: Found potentially dangerous import: $import_pattern"
        fi
    done
    
    # Check for suspicious function calls
    echo ""
    echo "Suspicious function calls:"
    DANGEROUS_FUNCTIONS=("eval(" "exec(" "compile(" "os.system(" "subprocess.call(" "subprocess.run(")
    
    for func in "${DANGEROUS_FUNCTIONS[@]}"; do
        if find "$WORKSPACE_DIR" -name "*.py" -type f -exec grep -l "$func" {} \; 2>/dev/null | head -3; then
            echo "WARNING: Found usage of potentially dangerous function: $func"
        fi
    done
    
} > "$OUTPUT_DIR/suspicious-patterns.txt"

# Analyze file structure
log "Analyzing file structure..."
{
    echo "=== FILE STRUCTURE ANALYSIS ==="
    find "$WORKSPACE_DIR" -type f -name "*.py" | head -50
    echo ""
    echo "=== SUSPICIOUS FILES ==="
    find "$WORKSPACE_DIR" -type f \( -name "*.exe" -o -name "*.dll" -o -name "*.so" -o -name "*.bin" \) 2>/dev/null || echo "No suspicious binary files found"
    echo ""
    echo "=== PYTHON CACHE FILES ==="
    find "$WORKSPACE_DIR" -name "__pycache__" -type d 2>/dev/null || echo "No cache directories found"
    find "$WORKSPACE_DIR" -name "*.pyc" -type f 2>/dev/null | head -10 || echo "No .pyc files found"
} > "$OUTPUT_DIR/file-structure.txt"

# Security vulnerability scan
log "Scanning for security vulnerabilities..."
{
    echo "=== SECURITY VULNERABILITY SCAN ==="
    
    # Check for hardcoded secrets
    echo "Hardcoded secrets check:"
    SECRET_PATTERNS=("password\s*=" "secret\s*=" "token\s*=" "api_key\s*=" "private_key\s*=")
    
    for pattern in "${SECRET_PATTERNS[@]}"; do
        if find "$WORKSPACE_DIR" -name "*.py" -type f -exec grep -i -E "$pattern" {} \; 2>/dev/null | head -3; then
            echo "WARNING: Potential hardcoded secret pattern: $pattern"
        fi
    done
    
    # Check for SQL injection patterns
    echo ""
    echo "SQL injection patterns:"
    SQL_PATTERNS=("execute.*%" "cursor.*%" "query.*%" "SELECT.*%")
    
    for pattern in "${SQL_PATTERNS[@]}"; do
        if find "$WORKSPACE_DIR" -name "*.py" -type f -exec grep -i -E "$pattern" {} \; 2>/dev/null | head -3; then
            echo "WARNING: Potential SQL injection pattern: $pattern"
        fi
    done
    
    # Check for file system operations
    echo ""
    echo "File system operations:"
    FS_PATTERNS=("open(" "file(" "os.remove" "os.unlink" "shutil.rmtree")
    
    for pattern in "${FS_PATTERNS[@]}"; do
        if find "$WORKSPACE_DIR" -name "*.py" -type f -exec grep -l "$pattern" {} \; 2>/dev/null | head -3; then
            echo "INFO: Found file system operation: $pattern"
        fi
    done
    
} > "$OUTPUT_DIR/vulnerability-scan.txt"

# Check for common Python security issues
log "Checking for common Python security issues..."
{
    echo "=== PYTHON SECURITY ISSUES ==="
    
    # Check for pickle usage (deserialization vulnerability)
    echo "Pickle usage check:"
    if find "$WORKSPACE_DIR" -name "*.py" -type f -exec grep -l "pickle\." {} \; 2>/dev/null; then
        echo "WARNING: Found pickle usage - potential deserialization vulnerability"
    else
        echo "No pickle usage found"
    fi
    
    # Check for yaml.load (unsafe deserialization)
    echo ""
    echo "YAML unsafe load check:"
    if find "$WORKSPACE_DIR" -name "*.py" -type f -exec grep -l "yaml\.load(" {} \; 2>/dev/null; then
        echo "WARNING: Found yaml.load() - use yaml.safe_load() instead"
    else
        echo "No unsafe YAML loading found"
    fi
    
    # Check for shell=True in subprocess
    echo ""
    echo "Subprocess shell injection check:"
    if find "$WORKSPACE_DIR" -name "*.py" -type f -exec grep -l "shell=True" {} \; 2>/dev/null; then
        echo "WARNING: Found shell=True in subprocess - potential command injection"
    else
        echo "No shell=True usage found"
    fi
    
} > "$OUTPUT_DIR/python-security-issues.txt"

# Generate summary
log "Generating analysis summary..."
{
    echo "=== ANALYSIS SUMMARY ==="
    echo "Timestamp: $(date)"
    echo "Workspace: $WORKSPACE_DIR"
    echo ""
    
    # Count Python files
    PY_FILES=$(find "$WORKSPACE_DIR" -name "*.py" -type f | wc -l)
    echo "Python files: $PY_FILES"
    
    # Count dependencies
    if [[ -f "$WORKSPACE_DIR/requirements.txt" ]]; then
        REQ_COUNT=$(grep -v '^#' "$WORKSPACE_DIR/requirements.txt" | grep -v '^$' | wc -l)
        echo "Requirements.txt dependencies: $REQ_COUNT"
    fi
    
    # Check for virtual environment indicators
    if [[ -f "$WORKSPACE_DIR/Pipfile" ]]; then
        echo "Package manager: Pipenv"
    elif [[ -f "$WORKSPACE_DIR/pyproject.toml" ]]; then
        echo "Package manager: Poetry/Modern Python"
    elif [[ -f "$WORKSPACE_DIR/requirements.txt" ]]; then
        echo "Package manager: pip"
    else
        echo "Package manager: Unknown"
    fi
    
    # Check Python version requirements
    if [[ -f "$WORKSPACE_DIR/.python-version" ]]; then
        echo "Python version specified: $(cat "$WORKSPACE_DIR/.python-version")"
    elif grep -q "python_requires" "$WORKSPACE_DIR/setup.py" 2>/dev/null; then
        echo "Python version requirement found in setup.py"
    else
        echo "Python version: Not specified"
    fi
    
    # Check for common security files
    if [[ -f "$WORKSPACE_DIR/.bandit" ]]; then
        echo "Bandit config: Present"
    fi
    
    if [[ -f "$WORKSPACE_DIR/tox.ini" ]]; then
        echo "Tox config: Present"
    fi
    
} > "$OUTPUT_DIR/summary.txt"

log "Analysis completed successfully"
log "Results saved to: $OUTPUT_DIR"

# Set permissions for output files
chmod -R 644 "$OUTPUT_DIR"/*

exit 0