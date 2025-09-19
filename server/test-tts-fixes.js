#!/usr/bin/env node

// Test script to verify the ElevenLabs TTS alignment fixes
// This tests the critical fixes for character alignment bug

const { ElevenLabsService } = require('./src/services/elevenLabsService');

const SPANISH_TEST_TEXT = `
CAPÍTULO 1: LA AVENTURA COMIENZA

María era una niña muy curiosa que vivía en un pequeño pueblo cerca de las montañas. Cada mañana, se despertaba temprano para ayudar a su abuela en el jardín. Las flores eran hermosas y los pájaros cantaban alegremente.

Un día, mientras caminaba por el bosque, encontró una puerta misteriosa entre los árboles. La puerta era muy antigua y tenía grabados extraños. María decidió abrirla con mucho cuidado.

CAPÍTULO 2: EL MUNDO MÁGICO

Al abrir la puerta, María descubrió un mundo completamente diferente. Todo brillaba con colores que nunca había visto antes. Los árboles hablaban en susurros y las flores bailaban con el viento.

En este lugar mágico, conoció a un pequeño zorro dorado que se llamaba Estrella. Estrella le explicó que este era un reino especial donde los animales y las plantas vivían en perfecta armonía.

"Bienvenida al Reino de los Sueños", dijo Estrella con una sonrisa. "Aquí, todos los deseos buenos se pueden hacer realidad si tienes un corazón puro y valiente."
`.trim();

async function testTTSFixes() {
  console.log('🧪 TESTING TTS ALIGNMENT FIXES');
  console.log('=====================================');
  
  try {
    const elevenLabsService = new ElevenLabsService();
    
    console.log(`📊 Test Input:`);
    console.log(`   Text length: ${SPANISH_TEST_TEXT.length} characters`);
    console.log(`   Word count: ${SPANISH_TEST_TEXT.split(/\s+/).length} words`);
    console.log(`   Expected duration: 8-12 minutes (0.5-0.7 words/second)`);
    
    console.log(`\n🔧 Starting TTS generation with fixes...`);
    const result = await elevenLabsService.generateAudioWithTiming(
      SPANISH_TEST_TEXT, 
      'test_alignment_fixes'
    );
    
    console.log(`\n✅ RESULTS:`);
    console.log(`   Audio URL: ${result.audioUrl}`);
    console.log(`   Total duration: ${result.timingData.totalDuration.toFixed(2)} seconds (${(result.timingData.totalDuration/60).toFixed(2)} minutes)`);
    console.log(`   Word count: ${result.timingData.words.length} words`);
    console.log(`   Speech rate: ${(result.timingData.words.length / result.timingData.totalDuration).toFixed(2)} words/second`);
    console.log(`   Character alignment: input=${SPANISH_TEST_TEXT.length}, aligned=${result.timingData.charAlignment.chars.length}`);
    
    // Validate fixes
    const isValidDuration = result.timingData.totalDuration > 480; // > 8 minutes
    const isValidSpeechRate = (result.timingData.words.length / result.timingData.totalDuration) < 1.0; // < 1 word/sec
    const hasGoodAlignment = result.timingData.charAlignment.chars.length > (SPANISH_TEST_TEXT.length * 0.8); // 80% char alignment
    
    console.log(`\n🔍 VALIDATION:`);
    console.log(`   ✓ Duration > 8 minutes: ${isValidDuration ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ Speech rate < 1.0 w/s: ${isValidSpeechRate ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ Character alignment: ${hasGoodAlignment ? '✅ PASS' : '❌ FAIL'}`);
    
    if (isValidDuration && isValidSpeechRate && hasGoodAlignment) {
      console.log(`\n🎉 ALL FIXES WORKING! The alignment bug has been resolved.`);
    } else {
      console.log(`\n⚠️  Some issues remain. Check the logs for details.`);
    }
    
    // Sample word timings
    console.log(`\n📝 Sample word timings:`);
    result.timingData.words.slice(0, 5).forEach(word => {
      console.log(`   "${word.text}": ${word.startTime.toFixed(2)}s - ${word.endTime.toFixed(2)}s`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testTTSFixes().catch(console.error);