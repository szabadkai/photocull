// Test utility for thumbnail serving integration
import { ThumbnailService } from './thumbnailService'

export async function testThumbnailIntegration() {
  console.log('🧪 Testing thumbnail serving integration...')
  
  const thumbnailService = ThumbnailService.getInstance()
  
  // Test 1: Check if backend is responding
  try {
    const response = await fetch('/api/health')
    if (response.ok) {
      console.log('✅ Backend is responding')
    } else {
      console.log('❌ Backend health check failed')
      return false
    }
  } catch (error) {
    console.log('❌ Cannot connect to backend:', error)
    return false
  }
  
  // Test 2: Create a simple test thumbnail
  const canvas = document.createElement('canvas')
  canvas.width = 100
  canvas.height = 100
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    console.log('❌ Cannot create canvas context')
    return false
  }
  
  // Draw a simple test pattern
  ctx.fillStyle = '#FF0000'
  ctx.fillRect(0, 0, 50, 50)
  ctx.fillStyle = '#00FF00'
  ctx.fillRect(50, 0, 50, 50)
  ctx.fillStyle = '#0000FF'
  ctx.fillRect(0, 50, 50, 50)
  ctx.fillStyle = '#FFFF00'
  ctx.fillRect(50, 50, 50, 50)
  
  const testDataUrl = canvas.toDataURL('image/png')
  console.log('✅ Generated test thumbnail')
  
  // Test 3: Upload thumbnail to backend
  try {
    const uploadResult = await thumbnailService.uploadThumbnail(
      'test-photo-id',
      'test-photo.jpg',
      testDataUrl
    )
    
    if (uploadResult) {
      console.log('✅ Thumbnail uploaded successfully:', uploadResult.thumbnailPath)
      
      // Test 4: Try to retrieve the uploaded thumbnail
      const retrieveResponse = await fetch(uploadResult.thumbnailPath)
      if (retrieveResponse.ok) {
        console.log('✅ Thumbnail retrieval successful')
        console.log('🎉 All thumbnail integration tests passed!')
        return true
      } else {
        console.log('❌ Failed to retrieve uploaded thumbnail')
        return false
      }
    } else {
      console.log('❌ Thumbnail upload failed')
      return false
    }
  } catch (error) {
    console.log('❌ Thumbnail upload error:', error)
    return false
  }
}

// Test the getBestThumbnailUrl function
export function testThumbnailUrlLogic() {
  console.log('🧪 Testing thumbnail URL logic...')
  
  const thumbnailService = ThumbnailService.getInstance()
  
  // Test cases
  const testCases = [
    {
      name: 'Data URL thumbnail',
      photo: {
        id: 'photo1',
        analysis: {
          thumbnailPath: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        }
      },
      expected: 'data URL'
    },
    {
      name: 'Backend API path',
      photo: {
        id: 'photo2',
        analysis: {
          thumbnailPath: '/api/thumbnails/thumb_photo2_123456.jpg'
        }
      },
      expected: 'API path'
    },
    {
      name: 'Blob URL',
      photo: {
        id: 'photo3',
        analysis: {
          thumbnailPath: 'blob:http://localhost:3000/12345-6789'
        }
      },
      expected: 'blob URL'
    },
    {
      name: 'No thumbnail',
      photo: {
        id: 'photo4',
        analysis: {}
      },
      expected: null
    }
  ]
  
  let passed = 0
  let total = testCases.length
  
  testCases.forEach(testCase => {
    const result = thumbnailService.getBestThumbnailUrl(testCase.photo as any)
    
    if (testCase.expected === null && result === null) {
      console.log(`✅ ${testCase.name}: correctly returned null`)
      passed++
    } else if (testCase.expected === 'data URL' && result?.startsWith('data:')) {
      console.log(`✅ ${testCase.name}: correctly returned data URL`)
      passed++
    } else if (testCase.expected === 'API path' && result?.startsWith('/api/thumbnails/')) {
      console.log(`✅ ${testCase.name}: correctly returned API path`)
      passed++
    } else if (testCase.expected === 'blob URL' && result?.startsWith('blob:')) {
      console.log(`✅ ${testCase.name}: correctly returned blob URL`)
      passed++
    } else {
      console.log(`❌ ${testCase.name}: expected ${testCase.expected}, got ${result}`)
    }
  })
  
  console.log(`🎯 Thumbnail URL logic tests: ${passed}/${total} passed`)
  return passed === total
}

// Helper to add test button to UI (for development)
export function addTestButton() {
  const button = document.createElement('button')
  button.textContent = '🧪 Test Thumbnails'
  button.style.position = 'fixed'
  button.style.top = '10px'
  button.style.right = '10px'
  button.style.zIndex = '9999'
  button.style.padding = '10px'
  button.style.backgroundColor = '#007bff'
  button.style.color = 'white'
  button.style.border = 'none'
  button.style.borderRadius = '5px'
  button.style.cursor = 'pointer'
  
  button.onclick = async () => {
    console.clear()
    console.log('🚀 Starting thumbnail integration tests...')
    
    const urlLogicTest = testThumbnailUrlLogic()
    const integrationTest = await testThumbnailIntegration()
    
    if (urlLogicTest && integrationTest) {
      console.log('🎉 All tests passed! Thumbnail serving is working correctly.')
      alert('✅ All thumbnail tests passed!')
    } else {
      console.log('❌ Some tests failed. Check console for details.')
      alert('❌ Some thumbnail tests failed. Check console for details.')
    }
  }
  
  document.body.appendChild(button)
  console.log('🧪 Test button added to page. Click to run thumbnail tests.')
}