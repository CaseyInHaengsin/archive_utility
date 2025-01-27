import { checkbox, input, select } from '@inquirer/prompts'
import fs from 'node:fs'
import path from 'node:path'

import archiver from 'archiver'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

function getContents (srcPath) {
  return fs.readdirSync(srcPath, { withFileTypes: true }).map(dirent => ({
    name: dirent.name,
    isDirectory: dirent.isDirectory(),
    type: dirent.isDirectory() ? 'directory' : 'file',
    extension: dirent.isDirectory()
      ? null
      : path.extname(dirent.name).toLowerCase()
  }))
}

async function copyDirectory (src, dest) {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else {
      await fs.promises.copyFile(srcPath, destPath)
    }
  }
}

async function removeDirectory (dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await removeDirectory(fullPath)
    } else {
      await fs.promises.unlink(fullPath)
    }
  }
  await fs.promises.rmdir(dir)
}
async function zipDirectory (source, out) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(out)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(`Zipped ${archive.pointer()} total bytes.`)
      resolve()
    })

    archive.on('error', err => reject(err))

    archive.pipe(output)
    archive.directory(source, false)
    archive.finalize()
  })
}

async function main () {
  const sourceDirArg = process.argv[2]
  const sourceDir = sourceDirArg
    ? path.resolve(sourceDirArg)
    : path.resolve(process.cwd())

  const customFolderName = await input({
    message: 'Enter a name for the shared folder:',
    default: 'shared-folder'
  })

  const sharedFolder = path.join(sourceDir, customFolderName)
  const zipFile = path.join(sourceDir, `${customFolderName}.zip`)

  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Directory ${sourceDir} does not exist.`)
    process.exit(1)
  }

  const contents = getContents(sourceDir)

  if (contents.length === 0) {
    console.log('No files or directories found to select from.')
    return
  }

  const extensions = [
    ...new Set(
      contents.filter(item => item.extension).map(item => item.extension)
    )
  ].sort()

  const filterOption = await select({
    message: 'How would you like to filter the items?',
    choices: [
      { name: 'Show all items', value: 'all' },
      { name: 'Show only directories', value: 'directories' },
      { name: 'Filter by file extension', value: 'extension' }
    ]
  })

  let filteredContents = contents
  if (filterOption === 'directories') {
    filteredContents = contents.filter(item => item.isDirectory)
  } else if (filterOption === 'extension' && extensions.length > 0) {
    const selectedExtension = await select({
      message: 'Select file extension to filter by:',
      choices: extensions.map(ext => ({
        name: ext || '(no extension)',
        value: ext
      }))
    })
    filteredContents = contents.filter(
      item => item.extension === selectedExtension
    )
  }

  if (filteredContents.length === 0) {
    console.log('No items match your filter criteria.')
    return
  }

  const selected = await checkbox({
    message: `Select files and folders to move to ${customFolderName} (${sourceDir}):`,
    choices: filteredContents.map(item => ({
      name: `${item.name} (${item.type})`,
      value: item.name
    }))
  })

  if (selected.length === 0) {
    console.log('No items selected. Exiting...')
    return
  }

  await fs.promises.mkdir(sharedFolder, { recursive: true })

  console.log(`Moving selected items to ${customFolderName}...`)
  for (const item of selected) {
    const sourcePath = path.join(sourceDir, item)
    const destPath = path.join(sharedFolder, item)

    try {
      const stats = await fs.promises.stat(sourcePath)
      if (stats.isDirectory()) {
        await copyDirectory(sourcePath, destPath)
      } else {
        await fs.promises.copyFile(sourcePath, destPath)
      }
      console.log(`Copied: ${item}`)
    } catch (err) {
      console.error(`Failed to copy ${item}:`, err.message)
    }
  }

  console.log(`Zipping the ${customFolderName}...`)
  try {
    await zipDirectory(sharedFolder, zipFile)
    console.log(`Zipped successfully: ${zipFile}`)
  } catch (err) {
    console.error(`Failed to zip the ${customFolderName}:`, err.message)
  }

  console.log(`Cleaning up ${customFolderName}...`)
  try {
    await removeDirectory(sharedFolder)
    console.log(`${customFolderName} cleaned up.`)
  } catch (err) {
    console.error(`Failed to clean up ${customFolderName}:`, err.message)
  }

  console.log('Deleting original selected items...')
  for (const item of selected) {
    const sourcePath = path.join(sourceDir, item)
    try {
      const stats = await fs.promises.stat(sourcePath)
      if (stats.isDirectory()) {
        await removeDirectory(sourcePath)
      } else {
        await fs.promises.unlink(sourcePath)
      }
      console.log(`Deleted: ${item}`)
    } catch (err) {
      console.error(`Failed to delete ${item}:`, err.message)
    }
  }

  console.log('Done!')
}

main().catch(err => {
  console.error('Error:', err.message)
})

console.log(getContents(__dirname))
