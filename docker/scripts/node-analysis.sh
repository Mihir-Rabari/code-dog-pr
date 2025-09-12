#!/bin/bash

# Node.js Security Analysis Script
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

log "Starting Node.js security analysis..."

# Check if package.json exists
if [[ ! -f "$WORKSPACE_DIR/package.json" ]]; then
    log "ERROR: No package.json found in workspace"
    exit 1
fi

# Parse package.json
log "Parsing package.json..."
jq . "$WORKSPACE_DIR/package.json" > "$OUTPUT_DIR/package-info.json" 2>/dev/null || {
    log "ERROR: Invalid package.json format"
    exit 1
}

# Extract dependencies
log "Extracting dependencies..."
{
    echo "=== PRODUCTION DEPENDENCIES ==="
    jq -r '.dependencies // {} | to_entries[] | "\(.key)@\(.value)"' "$WORKSPACE_DIR/package.json"
    echo ""
    echo "=== DEVELOPMENT DEPENDENCIES ==="
    jq -r '.devDependencies // {} | to_entries[] | "\(.key)@\(.value)"' "$WORKSPACE_DIR/package.json"
} > "$OUTPUT_DIR/dependencies.txt"

# Check for suspicious patterns in package.json
log "Checking for suspicious patterns..."
{
    echo "=== SUSPICIOUS PATTERNS CHECK ==="
    
    # Check for suspicious scripts
    if jq -e '.scripts' "$WORKSPACE_DIR/package.json" >/dev/null 2>&1; then
        echo "Scripts found:"
        jq -r '.scripts | to_entries[] | "  \(.key): \(.value)"' "$WORKSPACE_DIR/package.json"
        
        # Check for dangerous script patterns
        DANGEROUS_PATTERNS=("curl" "wget" "rm -rf" "sudo" "chmod 777" "eval" "exec")
        for pattern in "${DANGEROUS_PATTERNS[@]}"; do
            if jq -r '.scripts | to_entries[] | .value' "$WORKSPACE_DIR/package.json" | grep -q "$pattern"; then
                echo "WARNING: Suspicious pattern '$pattern' found in scripts"
            fi
        done
    fi
    
    # Check for suspicious dependencies
    SUSPICIOUS_DEPS=("eval" "exec" "child_process" "fs-extra" "shelljs")
    for dep in "${SUSPICIOUS_DEPS[@]}"; do
        if jq -e ".dependencies.\"$dep\" or .devDependencies.\"$dep\"" "$WORKSPACE_DIR/package.json" >/dev/null 2>&1; then
            echo "WARNING: Potentially dangerous dependency '$dep' found"
        fi
    done
    
} > "$OUTPUT_DIR/suspicious-patterns.txt"

# Analyze file structure
log "Analyzing file structure..."
{
    echo "=== FILE STRUCTURE ANALYSIS ==="
    find "$WORKSPACE_DIR" -type f -name "*.js" -o -name "*.ts" -o -name "*.json" | head -50
    echo ""
    echo "=== SUSPICIOUS FILES ==="
    find "$WORKSPACE_DIR" -type f \( -name "*.exe" -o -name "*.dll" -o -name "*.so" -o -name "*.bin" \) 2>/dev/null || echo "No suspicious binary files found"
} > "$OUTPUT_DIR/file-structure.txt"

# Check for common vulnerability patterns in code
log "Scanning for vulnerability patterns..."
{
    echo "=== VULNERABILITY PATTERNS ==="
    
    # Look for dangerous function calls
    DANGEROUS_FUNCTIONS=("eval(" "Function(" "setTimeout(" "setInterval(" "exec(" "spawn(")
    
    for func in "${DANGEROUS_FUNCTIONS[@]}"; do
        echo "Checking for $func..."
        if find "$WORKSPACE_DIR" -name "*.js" -type f -exec grep -l "$func" {} \; 2>/dev/null | head -5; then
            echo "WARNING: Found usage of potentially dangerous function: $func"
        fi
    done
    
    # Check for hardcoded secrets
    echo ""
    echo "=== HARDCODED SECRETS CHECK ==="
    SECRET_PATTERNS=("password" "secret" "token" "api_key" "private_key")
    
    for pattern in "${SECRET_PATTERNS[@]}"; do
        if find "$WORKSPACE_DIR" -name "*.js" -o -name "*.json" -type f -exec grep -i "$pattern" {} \; 2>/dev/null | head -3; then
            echo "WARNING: Potential hardcoded secret pattern: $pattern"
        fi
    done
    
} > "$OUTPUT_DIR/vulnerability-scan.txt"

# Generate summary
log "Generating analysis summary..."
{
    echo "=== ANALYSIS SUMMARY ==="
    echo "Timestamp: $(date)"
    echo "Workspace: $WORKSPACE_DIR"
    echo ""
    
    # Count dependencies
    PROD_DEPS=$(jq -r '.dependencies // {} | length' "$WORKSPACE_DIR/package.json")
    DEV_DEPS=$(jq -r '.devDependencies // {} | length' "$WORKSPACE_DIR/package.json")
    echo "Production dependencies: $PROD_DEPS"
    echo "Development dependencies: $DEV_DEPS"
    echo "Total dependencies: $((PROD_DEPS + DEV_DEPS))"
    echo ""
    
    # Count files
    JS_FILES=$(find "$WORKSPACE_DIR" -name "*.js" -type f | wc -l)
    TS_FILES=$(find "$WORKSPACE_DIR" -name "*.ts" -type f | wc -l)
    JSON_FILES=$(find "$WORKSPACE_DIR" -name "*.json" -type f | wc -l)
    echo "JavaScript files: $JS_FILES"
    echo "TypeScript files: $TS_FILES"
    echo "JSON files: $JSON_FILES"
    echo ""
    
    # Check for package-lock.json
    if [[ -f "$WORKSPACE_DIR/package-lock.json" ]]; then
        echo "Package lock file: Present"
    else
        echo "Package lock file: Missing (potential security risk)"
    fi
    
    # Check for .nvmrc
    if [[ -f "$WORKSPACE_DIR/.nvmrc" ]]; then
        echo "Node version specified: $(cat "$WORKSPACE_DIR/.nvmrc")"
    else
        echo "Node version: Not specified"
    fi
    
} > "$OUTPUT_DIR/summary.txt"

log "Analysis completed successfully"
log "Results saved to: $OUTPUT_DIR"

# Set permissions for output files
chmod -R 644 "$OUTPUT_DIR"/*

exit 0