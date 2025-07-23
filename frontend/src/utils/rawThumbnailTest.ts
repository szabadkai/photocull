// Test utility for RAW thumbnail extraction
import { extractRawThumbnail, getRawFileInfo, likelyHasEmbeddedJpeg, createRawPlaceholder } from './rawThumbnailExtractor'

export async function testRawThumbnailExtraction(files: FileList | File[]) {
  console.log('🧪 Testing RAW thumbnail extraction...')
  
  const rawFiles = Array.from(files).filter(file => {
    const info = getRawFileInfo(file)
    return info.isRaw
  })
  
  if (rawFiles.length === 0) {
    console.log('❌ No RAW files found in selection')
    return
  }
  
  console.log(`📷 Found ${rawFiles.length} RAW files:`)
  rawFiles.forEach(file => {
    const info = getRawFileInfo(file)
    console.log(`  - ${file.name} (${info.format}, ${info.manufacturer})`)
  })
  
  let successCount = 0
  let failCount = 0
  
  for (const file of rawFiles) {
    console.log(`\n🔍 Processing: ${file.name}`)
    
    const info = getRawFileInfo(file)
    const hasEmbedded = likelyHasEmbeddedJpeg(file)
    
    console.log(`  Format: ${info.format} (${info.manufacturer})`)
    console.log(`  Size: ${(file.size / 1024 / 1024).toFixed(1)} MB`)
    console.log(`  Likely has embedded JPEG: ${hasEmbedded}`)
    
    if (hasEmbedded) {
      try {
        const startTime = performance.now()
        const thumbnail = await extractRawThumbnail(file)
        const endTime = performance.now()
        
        if (thumbnail) {
          console.log(`  ✅ Extraction successful in ${(endTime - startTime).toFixed(0)}ms`)
          
          // Get image dimensions
          const img = new Image()
          const dimensions = await new Promise<{width: number, height: number}>((resolve) => {
            img.onload = () => {
              resolve({ width: img.width, height: img.height })
              URL.revokeObjectURL(img.src)
            }
            img.onerror = () => {
              resolve({ width: 0, height: 0 })
              URL.revokeObjectURL(img.src)
            }
            img.src = URL.createObjectURL(thumbnail)
          })
          
          console.log(`  📐 Thumbnail dimensions: ${dimensions.width}x${dimensions.height}`)
          console.log(`  📦 Thumbnail size: ${(thumbnail.size / 1024).toFixed(1)} KB`)
          
          successCount++
        } else {
          console.log(`  ❌ No embedded JPEG found after ${(endTime - startTime).toFixed(0)}ms`)
          
          // Try creating placeholder
          const placeholder = await createRawPlaceholder(file)
          console.log(`  🎨 Created placeholder: ${placeholder.width}x${placeholder.height}`)
          
          failCount++
        }
      } catch (error) {
        console.log(`  💥 Extraction failed: ${error}`)
        failCount++
      }
    } else {
      console.log(`  ⚠️  Format ${info.format} not expected to have embedded JPEG`)
      
      // Still try extraction as fallback
      try {
        const thumbnail = await extractRawThumbnail(file)
        if (thumbnail) {
          console.log(`  🎉 Unexpected success! Found embedded JPEG`)
          successCount++
        } else {
          const placeholder = await createRawPlaceholder(file)
          console.log(`  🎨 Created placeholder: ${placeholder.width}x${placeholder.height}`)
          failCount++
        }
      } catch (error) {
        console.log(`  💥 Extraction failed: ${error}`)
        failCount++
      }
    }
  }
  
  console.log(`\n📊 RAW Thumbnail Extraction Results:`)
  console.log(`  ✅ Successful extractions: ${successCount}`)
  console.log(`  ❌ Failed extractions: ${failCount}`)
  console.log(`  📈 Success rate: ${((successCount / rawFiles.length) * 100).toFixed(1)}%`)
  
  if (successCount > 0) {
    console.log(`\n🎉 RAW thumbnail extraction is working! ${successCount} out of ${rawFiles.length} files processed successfully.`)
  } else {
    console.log(`\n⚠️  No RAW thumbnails could be extracted. This might indicate:`)
    console.log(`     - RAW files don't have embedded JPEG previews`)
    console.log(`     - Files are corrupted or in an unsupported format`)
    console.log(`     - Extraction algorithm needs improvement for these specific files`)
  }
}

export function addRawTestButton() {
  const button = document.createElement('button')
  button.textContent = '📷 Test RAW Thumbnails'
  button.style.position = 'fixed'
  button.style.top = '60px'
  button.style.right = '10px'
  button.style.zIndex = '9999'
  button.style.padding = '10px'
  button.style.backgroundColor = '#7C3AED'
  button.style.color = 'white'
  button.style.border = 'none'
  button.style.borderRadius = '5px'
  button.style.cursor = 'pointer'
  
  button.onclick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2,.pef,.srw,.x3f'
    input.style.display = 'none'
    
    input.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files
      if (files && files.length > 0) {
        console.clear()
        console.log('🚀 Starting RAW thumbnail extraction test...')
        await testRawThumbnailExtraction(files)
      }
    }
    
    document.body.appendChild(input)
    input.click()
    document.body.removeChild(input)
  }
  
  document.body.appendChild(button)
  console.log('📷 RAW test button added. Click to test RAW thumbnail extraction.')
}

// Helper function to analyze RAW file structure
export async function analyzeRawFileStructure(file: File) {
  console.log(`🔍 Analyzing RAW file structure: ${file.name}`)
  
  const arrayBuffer = await file.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)
  
  // Check file header
  const header = Array.from(data.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
  console.log(`📂 File header (first 16 bytes): ${header}`)
  
  // Look for JPEG markers
  let jpegCount = 0
  let searchStart = 0
  const jpegSizes: number[] = []
  
  while (searchStart < data.length) {
    const jpegStart = findJpegMarker(data, [0xFF, 0xD8], searchStart)
    if (jpegStart < 0) break
    
    const jpegEnd = findJpegMarker(data, [0xFF, 0xD9], jpegStart + 2)
    if (jpegEnd >= 0) {
      const size = jpegEnd - jpegStart + 2
      jpegSizes.push(size)
      jpegCount++
      console.log(`📸 JPEG ${jpegCount}: ${jpegStart}-${jpegEnd} (${(size/1024).toFixed(1)} KB)`)
    }
    
    searchStart = jpegStart + 2
  }
  
  console.log(`📊 Found ${jpegCount} potential JPEG previews`)
  if (jpegSizes.length > 0) {
    console.log(`📏 Sizes: ${jpegSizes.map(s => (s/1024).toFixed(1) + 'KB').join(', ')}`)
    console.log(`🏆 Largest: ${Math.max(...jpegSizes)/1024} KB`)
  }
}

function findJpegMarker(data: Uint8Array, marker: number[], startOffset: number = 0): number {
  for (let i = startOffset; i <= data.length - marker.length; i++) {
    let found = true
    for (let j = 0; j < marker.length; j++) {
      if (data[i + j] !== marker[j]) {
        found = false
        break
      }
    }
    if (found) {
      return i
    }
  }
  return -1
}