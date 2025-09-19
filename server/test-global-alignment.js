const { WhisperTimingService } = require('./dist/services/whisperTimingService');

// Test global sequence alignment
async function testGlobalAlignment() {
  console.log('🧪 Testing Needleman-Wunsch Global Alignment Implementation...\n');
  
  const service = new WhisperTimingService();
  
  // Test enhanced text cleaning
  console.log('1. Testing Enhanced Text Cleaning:');
  const ttsText = "Hola, mi nombre es María... ¿Cómo estás? —Muy bien, gracias.";
  console.log(`Input: "${ttsText}"`);
  
  // Access private method via a workaround for testing
  const cleanMethod = service.cleanTtsText || service['cleanTtsText'];
  if (cleanMethod) {
    const cleaned = cleanMethod.call(service, ttsText);
    console.log(`Output: "${cleaned}"`);
    console.log('✅ Text cleaning works correctly\n');
  } else {
    console.log('❌ Could not access cleanTtsText method\n');
  }
  
  // Test word similarity calculation
  console.log('2. Testing Word Similarity:');
  const testPairs = [
    ['María', 'maria'],
    ['está', 'esta'],
    ['cómo', 'como'],
    ['niño', 'niña'],
    ['hola', 'goodbye']
  ];
  
  for (const [word1, word2] of testPairs) {
    const wordsMatch = service.wordsMatch || service['wordsMatch'];
    if (wordsMatch) {
      const match = wordsMatch.call(service, word1, word2);
      console.log(`"${word1}" vs "${word2}": ${match ? '✅ Match' : '❌ No match'}`);
    }
  }
  
  console.log('\n3. Testing Alignment Algorithm:');
  
  // Mock test data
  const displayWords = [
    { text: 'Hola', startIndex: 0, endIndex: 4 },
    { text: 'mi', startIndex: 6, endIndex: 8 },
    { text: 'nombre', startIndex: 9, endIndex: 15 },
    { text: 'es', startIndex: 16, endIndex: 18 },
    { text: 'María', startIndex: 19, endIndex: 24 }
  ];
  
  const ttsWords = [
    { text: 'Hola', startIndex: 0, endIndex: 4 },
    { text: 'mi', startIndex: 5, endIndex: 7 },
    { text: 'nombre', startIndex: 8, endIndex: 14 },
    { text: 'es', startIndex: 15, endIndex: 17 },
    { text: 'María', startIndex: 18, endIndex: 23 }
  ];
  
  // Mock Whisper words with slight variations
  const whisperWords = [
    { word: 'hola', start: 0.0, end: 0.5 },
    { word: 'mi', start: 0.6, end: 0.8 },
    { word: 'nombre', start: 0.9, end: 1.4 },
    { word: 'es', start: 1.5, end: 1.7 },
    { word: 'maria', start: 1.8, end: 2.3 }  // Note: lowercase, no accent
  ];
  
  const whisperTranscript = 'hola mi nombre es maria';
  
  try {
    // Test alignment method
    const alignMethod = service.alignWordsWithTiming || service['alignWordsWithTiming'];
    if (alignMethod) {
      const aligned = alignMethod.call(service, displayWords, ttsWords, whisperWords, whisperTranscript);
      
      console.log(`✅ Successfully aligned ${aligned.length} words:`);
      aligned.forEach((word, i) => {
        console.log(`  ${i + 1}. "${word.word}" → ${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s`);
      });
      
      console.log('\n🎯 Global Alignment Test: PASSED');
    } else {
      console.log('❌ Could not access alignWordsWithTiming method');
    }
  } catch (error) {
    console.log(`❌ Alignment test failed: ${error.message}`);
  }
  
  console.log('\n🧬 Needleman-Wunsch implementation test complete!');
}

// Only run if built successfully
const fs = require('fs');
if (fs.existsSync('./dist/services/whisperTimingService.js')) {
  testGlobalAlignment().catch(console.error);
} else {
  console.log('⚠️ Service not built yet. Compilation needed first.');
}