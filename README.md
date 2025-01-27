# Folder Archiver

Folder Archiver is a Node.js CLI tool that allows you to interactively filter, select, and archive files and directories from a source folder. It supports filtering by type (directories or files) and file extension, and it compresses the selected items into a ZIP file while optionally cleaning up the original items.

## Features

- Interactive file and directory selection using prompts.
- Filter items by type (directories or files) or file extension.
- Archive selected items into a ZIP file.
- Optionally deletes original items after archiving.
- Fully customizable shared folder name.

## Prerequisites

- Node.js 16+ installed on your system.

## Installation

1. Clone the repository:
   ```bash
   git clone git@github.com:CaseyInHaengsin/archive_utility.git
   cd folder-archiver
   npm install
   node index.js /absolute/folder/path
   ```
