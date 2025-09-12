# Requirements Document

## Introduction

The AI-Powered Supply Chain Threat Detection system is a full-stack application that analyzes GitHub repositories for security threats in real-time. Users submit a repository URL and project type, and the system clones the repo into a sandboxed Docker container, builds the project, captures logs, runs AI-powered analysis on commits and dependencies, and streams results to a real-time dashboard with risk scoring and alerts.

## Requirements

### Requirement 1

**User Story:** As a security analyst, I want to submit a GitHub repository URL for analysis, so that I can quickly assess potential supply chain threats in the codebase.

#### Acceptance Criteria

1. WHEN a user accesses the landing page THEN the system SHALL display an input field for repository URL and a dropdown for project type selection
2. WHEN a user enters a valid GitHub repository URL THEN the system SHALL validate the URL format
3. WHEN a user selects a project type (Node.js or Python) THEN the system SHALL enable the analyze button
4. WHEN a user clicks "Analyze Repo" THEN the system SHALL create a new analysis job and return a unique job ID
5. WHEN the analysis starts THEN the system SHALL redirect the user to a real-time dashboard

### Requirement 2

**User Story:** As a security analyst, I want the system to safely clone and build repositories in isolated environments, so that malicious code cannot affect the host system.

#### Acceptance Criteria

1. WHEN an analysis job is created THEN the system SHALL clone the repository into a sandboxed Docker container
2. WHEN the repository is cloned THEN the system SHALL select the appropriate Docker image based on project type (Node.js or Python)
3. WHEN building a Node.js project THEN the system SHALL run "npm install" and capture all output
4. WHEN building a Python project THEN the system SHALL run "pip install -r requirements.txt" and capture all output
5. WHEN any build step fails THEN the system SHALL continue analysis with available data and log the failure
6. WHEN the container runs THEN the system SHALL capture both stdout and stderr streams

### Requirement 3

**User Story:** As a security analyst, I want to see real-time logs and analysis results, so that I can monitor the analysis progress and identify threats as they are detected.

#### Acceptance Criteria

1. WHEN an analysis job starts THEN the system SHALL establish a WebSocket connection for real-time updates
2. WHEN build logs are generated THEN the system SHALL stream them immediately to the frontend via WebSocket
3. WHEN the AI analysis detects a threat THEN the system SHALL send an alert event with threat details
4. WHEN analysis progress updates THEN the system SHALL send progress percentage events
5. WHEN the analysis completes THEN the system SHALL send a final summary event with risk score and all alerts

### Requirement 4

**User Story:** As a security analyst, I want the system to analyze dependencies for threats, so that I can identify potentially malicious or typosquatted packages.

#### Acceptance Criteria

1. WHEN analyzing dependencies THEN the system SHALL scan package.json (Node.js) or requirements.txt (Python) files
2. WHEN a dependency name is similar to a popular package THEN the system SHALL flag it as potential typosquatting
3. WHEN a dependency has known security vulnerabilities THEN the system SHALL flag it as risky
4. WHEN suspicious dependencies are found THEN the system SHALL generate alerts with package names and risk levels
5. WHEN dependency analysis completes THEN the system SHALL provide a summary of all flagged packages

### Requirement 5

**User Story:** As a security analyst, I want the system to analyze commit history for suspicious changes, so that I can identify potentially malicious code modifications.

#### Acceptance Criteria

1. WHEN analyzing commits THEN the system SHALL examine recent commit messages and code changes
2. WHEN a commit contains suspicious patterns (exec calls, crypto mining, obfuscation) THEN the system SHALL flag it as high risk
3. WHEN unusual file modifications are detected THEN the system SHALL flag the commit with appropriate risk level
4. WHEN commit analysis completes THEN the system SHALL provide a timeline of commits with risk scores
5. WHEN suspicious commits are found THEN the system SHALL generate detailed alerts with commit hashes and reasons

### Requirement 6

**User Story:** As a security analyst, I want to view analysis results in an organized dashboard, so that I can quickly understand the security posture of the repository.

#### Acceptance Criteria

1. WHEN the dashboard loads THEN the system SHALL display the repository name and current job status
2. WHEN viewing results THEN the system SHALL organize information into tabs: Logs, Commits, Dependencies, and Summary
3. WHEN in the Logs tab THEN the system SHALL display real-time console output with auto-scroll functionality
4. WHEN in the Commits tab THEN the system SHALL show a timeline of commits with risk score badges
5. WHEN in the Dependencies tab THEN the system SHALL display a table of packages with safety status indicators
6. WHEN in the Summary tab THEN the system SHALL show an overall risk score gauge and list of all alerts

### Requirement 7

**User Story:** As a security analyst, I want to receive a comprehensive risk assessment, so that I can make informed decisions about the repository's security.

#### Acceptance Criteria

1. WHEN analysis completes THEN the system SHALL calculate an overall risk score from 0-100
2. WHEN calculating risk score THEN the system SHALL weight dependency threats, commit risks, and runtime anomalies
3. WHEN the risk score is calculated THEN the system SHALL categorize it as Low (0-33), Medium (34-66), or High (67-100)
4. WHEN displaying the risk score THEN the system SHALL show it prominently with appropriate color coding
5. WHEN alerts are generated THEN the system SHALL categorize them by severity and provide actionable descriptions

### Requirement 8

**User Story:** As a security analyst, I want the system to handle multiple concurrent analyses, so that my team can analyze multiple repositories simultaneously.

#### Acceptance Criteria

1. WHEN multiple analysis requests are received THEN the system SHALL process them concurrently without blocking
2. WHEN system resources are limited THEN the system SHALL queue additional requests appropriately
3. WHEN checking job status THEN the system SHALL provide accurate status for each individual job
4. WHEN a job fails THEN the system SHALL not affect other running jobs
5. WHEN jobs complete THEN the system SHALL clean up associated Docker containers and temporary files

### Requirement 9

**User Story:** As a security analyst, I want the interface to be visually appealing and professional, so that I can present results to stakeholders effectively.

#### Acceptance Criteria

1. WHEN the application loads THEN the system SHALL display a clean, professional interface using TailwindCSS
2. WHEN viewing in different lighting conditions THEN the system SHALL support both light and dark themes
3. WHEN alerts are displayed THEN the system SHALL use appropriate color coding (red for high risk, yellow for medium, green for safe)
4. WHEN logs are streaming THEN the system SHALL display them in a console-style interface with monospaced font
5. WHEN the analysis completes THEN the system SHALL present a judge-friendly summary suitable for demonstration