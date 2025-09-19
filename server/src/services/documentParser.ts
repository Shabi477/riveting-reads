import mammoth from 'mammoth';
import natural from 'natural';
import compromise from 'compromise';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

// Spanish language configuration for natural
// Note: Using stemmer directly without attach method

interface ParsedElement {
  text: string;
  fontSize?: number;
  isBold?: boolean;
  isHeading?: boolean;
  elementType: 'paragraph' | 'heading' | 'table' | 'other';
}

interface DocxRun {
  text: string;
  fontSize?: number;
  isBold?: boolean;
}

interface DocxParagraph {
  runs: DocxRun[];
  styleId?: string;
  styleName?: string;
}

interface ChapterData {
  id: string;
  title: string;
  indexInBook: number;
  content: ParsedElement[];
  wordCount: number;
  sentences: ProcessedSentence[];
  activities?: ChapterActivity[];
}

interface ChapterActivity {
  activityType: 'vocabulary_support' | 'comprehension_questions' | 'true_false' | 'matching' | 'writing_prompts';
  title: string;
  description?: string;
  activityData: any;
  sortOrder: number;
}

interface ProcessedSentence {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  words: ProcessedWord[];
}

interface ProcessedWord {
  id: string;
  text: string;
  lemma: string;
  pos: string; // part of speech
  startIndex: number;
  endIndex: number;
  clickable: boolean;
  definition?: string;
  audioTimestamp?: number;
}

interface ParsedDocument {
  chapters: ChapterData[];
  metadata: {
    totalChapters: number;
    totalWords: number;
    totalSentences: number;
    language: 'es'; // Spanish
    processingTime: number;
  };
}

interface FontMapping {
  [key: string]: number;
}

/**
 * Comprehensive Word document parser for Spanish storybooks
 * Analyzes font formatting to detect chapters and processes text for vocabulary features
 */
export class DocumentParser {
  private readonly CHAPTER_FONT_SIZE = 16; // 16pt indicates chapter headings
  private readonly BODY_FONT_SIZE = 12;    // 12pt indicates body text
  private readonly TOLERANCE = 1;          // Allow ±1pt variation in font detection
  
  private spanish_stopwords = new Set([
    'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son',
    'con', 'para', 'al', 'del', 'los', 'las', 'me', 'una', 'como', 'muy', 'si', 'más', 'pero', 'sus', 'fue', 'ser'
  ]);

  /**
   * Parse a Word document from file path
   */
  async parseDocument(filePath: string): Promise<ParsedDocument> {
    const startTime = Date.now();
    
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read the .docx file
      const buffer = fs.readFileSync(filePath) as any;
      
      // Configure mammoth to preserve formatting information
      const options = {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Title'] => h1:fresh"
        ],
        includeDefaultStyleMap: true
      };

      // Extract raw formatted content and HTML
      const htmlResult = await mammoth.convertToHtml(buffer as any, options);
      
      // Parse the formatted content to detect font sizes and structure
      const parsedElements = await this.parseFormattedContent(buffer);
      
      // Detect chapters based on font analysis
      const chapters = this.detectChapters(parsedElements);
      
      // Process Spanish text for each chapter
      const processedChapters = await Promise.all(
        chapters.map((chapter, index) => this.processChapterContent(chapter, index))
      );

      const processingTime = Date.now() - startTime;
      
      return {
        chapters: processedChapters,
        metadata: {
          totalChapters: processedChapters.length,
          totalWords: processedChapters.reduce((sum, ch) => sum + ch.wordCount, 0),
          totalSentences: processedChapters.reduce((sum, ch) => sum + ch.sentences.length, 0),
          language: 'es',
          processingTime
        }
      };
      
    } catch (error) {
      console.error('Error parsing document:', error);
      throw new Error(`Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse formatted content to extract elements with font information
   * Uses direct DOCX XML parsing for accurate font size detection
   */
  private async parseFormattedContent(buffer: Buffer): Promise<ParsedElement[]> {
    try {
      console.log('Parsing DOCX XML for accurate font size extraction...');
      
      // First try direct XML parsing for font sizes
      const docxParagraphs = await this.parseDocxXML(buffer);
      const elements: ParsedElement[] = [];
      
      for (const paragraph of docxParagraphs) {
        // Combine all runs in the paragraph
        const fullText = paragraph.runs.map(run => run.text).join('');
        
        if (fullText.trim()) {
          // Determine the dominant font size in the paragraph
          const fontSizes = paragraph.runs
            .map(run => run.fontSize)
            .filter(size => size !== undefined) as number[];
          
          const fontSize = fontSizes.length > 0 
            ? this.getMostCommonFontSize(fontSizes)
            : this.BODY_FONT_SIZE;
          
          // Check if any run is bold
          const isBold = paragraph.runs.some(run => run.isBold);
          
          const isHeading = this.isLikelyHeading(fullText, fontSize, isBold);
          
          elements.push({
            text: fullText.trim(),
            fontSize,
            isBold,
            isHeading,
            elementType: isHeading ? 'heading' : 'paragraph'
          });
        }
      }
      
      console.log(`Parsed ${elements.length} elements with XML font data`);
      return elements;
      
    } catch (error) {
      console.warn('XML parsing failed, falling back to HTML method:', error instanceof Error ? error.message : 'Unknown error');
      
      // Fallback to HTML parsing if XML parsing fails
      return this.parseFormattedContentFallback(buffer);
    }
  }

  /**
   * Get the most common font size from an array of sizes
   */
  private getMostCommonFontSize(fontSizes: number[]): number {
    if (fontSizes.length === 0) return this.BODY_FONT_SIZE;
    
    const frequency: { [key: number]: number } = {};
    
    for (const size of fontSizes) {
      frequency[size] = (frequency[size] || 0) + 1;
    }
    
    // Return the size with highest frequency, or first if tie
    let maxCount = 0;
    let mostCommon = fontSizes[0];
    
    for (const [size, count] of Object.entries(frequency)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = parseInt(size);
      }
    }
    
    return mostCommon;
  }

  /**
   * Extract plain text from HTML, removing tags
   */
  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&')  // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Parse DOCX XML to extract actual font sizes and formatting
   */
  private async parseDocxXML(buffer: Buffer): Promise<DocxParagraph[]> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file('word/document.xml')?.async('string');
      
      if (!documentXml) {
        throw new Error('Unable to extract document.xml from DOCX file');
      }

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
      });
      
      const xmlDoc = parser.parse(documentXml);
      const body = xmlDoc['w:document']['w:body'];
      
      const paragraphs: DocxParagraph[] = [];
      
      // Handle both single paragraph and array of paragraphs
      const pElements = Array.isArray(body['w:p']) ? body['w:p'] : [body['w:p']].filter(Boolean);
      
      for (const p of pElements) {
        if (!p) continue;
        
        const runs: DocxRun[] = [];
        
        // Handle runs within the paragraph
        const rElements = p['w:r'] ? (Array.isArray(p['w:r']) ? p['w:r'] : [p['w:r']]) : [];
        
        for (const r of rElements) {
          if (!r) continue;
          
          const text = this.extractTextFromRun(r);
          if (text) {
            const fontSize = this.extractFontSizeFromRun(r);
            const isBold = this.extractBoldFromRun(r);
            
            runs.push({
              text,
              fontSize,
              isBold
            });
          }
        }
        
        if (runs.length > 0) {
          paragraphs.push({ runs });
        }
      }
      
      return paragraphs;
    } catch (error) {
      console.error('Error parsing DOCX XML:', error);
      throw error instanceof Error ? error : new Error('Unknown error parsing DOCX XML');
    }
  }

  /**
   * Extract text from a word run element
   */
  private extractTextFromRun(run: any): string {
    let text = '';
    
    if (run['w:t']) {
      if (typeof run['w:t'] === 'string') {
        text += run['w:t'];
      } else if (run['w:t']['#text']) {
        text += run['w:t']['#text'];
      }
    }
    
    // Handle tabs and spaces
    if (run['w:tab']) {
      text += '\t';
    }
    if (run['w:br']) {
      text += '\n';
    }
    
    return text;
  }

  /**
   * Extract font size from run properties (w:sz element)
   */
  private extractFontSizeFromRun(run: any): number | undefined {
    try {
      const rPr = run['w:rPr'];
      if (rPr && rPr['w:sz'] && rPr['w:sz']['@_w:val']) {
        // w:sz values are in half-points, so divide by 2 to get points
        const halfPoints = parseInt(rPr['w:sz']['@_w:val']);
        return Math.round(halfPoints / 2);
      }
    } catch (error) {
      // Ignore parsing errors for individual runs
    }
    return undefined;
  }

  /**
   * Extract bold formatting from run properties
   */
  private extractBoldFromRun(run: any): boolean {
    try {
      const rPr = run['w:rPr'];
      return !!(rPr && rPr['w:b']);
    } catch (error) {
      return false;
    }
  }

  /**
   * Fallback HTML parsing method (kept as backup)
   */
  private async parseFormattedContentFallback(buffer: Buffer): Promise<ParsedElement[]> {
    try {
      // Use mammoth to extract structured content with formatting
      const result = await mammoth.convertToHtml(buffer as any, {
        styleMap: [
          "p => p:fresh",
          "b => strong",
          "i => em"
        ]
      });

      const elements: ParsedElement[] = [];
      
      // Parse HTML to extract text and formatting
      const htmlContent = result.value;
      
      // Split by paragraphs and analyze each one
      const paragraphs = htmlContent.split('</p>').filter(p => p.trim());
      
      for (const paragraph of paragraphs) {
        const cleanText = this.extractTextFromHtml(paragraph);
        if (cleanText.trim()) {
          const fontSize = this.estimateFontSizeHeuristic(paragraph, cleanText);
          const isBold = paragraph.includes('<strong>') || paragraph.includes('<b>');
          const isHeading = this.isLikelyHeading(cleanText, fontSize, isBold);
          
          elements.push({
            text: cleanText.trim(),
            fontSize,
            isBold,
            isHeading,
            elementType: isHeading ? 'heading' : 'paragraph'
          });
        }
      }

      return elements;
    } catch (error) {
      console.error('Error in fallback parsing:', error);
      throw error instanceof Error ? error : new Error('Unknown error in fallback parsing');
    }
  }

  /**
   * Heuristic font size estimation (fallback method)
   */
  private estimateFontSizeHeuristic(htmlContent: string, text: string): number {
    // Look for explicit style information
    const styleMatch = htmlContent.match(/font-size:\s*(\d+)pt/i);
    if (styleMatch) {
      return parseInt(styleMatch[1]);
    }

    // Analyze structural cues
    const isBold = htmlContent.includes('<strong>') || htmlContent.includes('<b>');
    const isUpperCase = text === text.toUpperCase() && text.length > 2;
    const isShort = text.length < 50;
    const hasChapterKeywords = /^(capítulo|capítulo\s+\d+|chapter)/i.test(text.trim());

    // Heuristic font size estimation
    if (hasChapterKeywords || (isBold && isShort && isUpperCase)) {
      return this.CHAPTER_FONT_SIZE; // Likely chapter heading
    } else if (isBold && isShort) {
      return 14; // Likely subheading
    } else {
      return this.BODY_FONT_SIZE; // Default body text
    }
  }

  /**
   * Determine if text is likely a heading based on multiple factors
   */
  private isLikelyHeading(text: string, fontSize: number, isBold: boolean): boolean {
    const hasChapterKeywords = /^(capítulo|capítulo\s+\d+|chapter)/i.test(text.trim());
    const isShort = text.length < 100;
    const isLargeFontSize = fontSize >= (this.CHAPTER_FONT_SIZE - this.TOLERANCE);
    const endsWithoutPunctuation = !/[.!?]$/.test(text.trim());

    return hasChapterKeywords || 
           (isLargeFontSize && isShort && endsWithoutPunctuation) ||
           (isBold && isShort && endsWithoutPunctuation && fontSize >= 14);
  }

  /**
   * Detect chapters based on font size analysis and content structure
   */
  private detectChapters(elements: ParsedElement[]): ChapterData[] {
    const chapters: ChapterData[] = [];
    let currentChapter: ChapterData | null = null;
    let chapterIndex = 0;

    for (const element of elements) {
      if (element.isHeading) {
        // Save previous chapter if exists
        if (currentChapter && currentChapter.content.length > 0) {
          chapters.push(currentChapter);
        }

        // Start new chapter
        chapterIndex++;
        currentChapter = {
          id: `chapter_${chapterIndex}`,
          title: element.text,
          indexInBook: chapterIndex,
          content: [element],
          wordCount: 0,
          sentences: []
        };
      } else if (currentChapter) {
        // Add content to current chapter
        currentChapter.content.push(element);
      } else {
        // Content before first chapter - create introduction chapter
        if (chapters.length === 0) {
          currentChapter = {
            id: 'chapter_intro',
            title: 'Introducción',
            indexInBook: 0,
            content: [element],
            wordCount: 0,
            sentences: []
          };
        }
      }
    }

    // Add final chapter
    if (currentChapter && currentChapter.content.length > 0) {
      chapters.push(currentChapter);
    }

    // Validate chapters and filter out very short ones
    return chapters.filter(chapter => {
      const totalText = chapter.content.map(c => c.text).join(' ');
      return totalText.trim().length > 50; // Minimum chapter length
    });
  }

  /**
   * Process chapter content for Spanish language features
   */
  private async processChapterContent(chapter: ChapterData, index: number): Promise<ChapterData> {
    try {
      // Combine all chapter text (excluding the title)
      const bodyElements = chapter.content.filter(c => !c.isHeading);
      const fullText = bodyElements.map(c => c.text).join(' ');

      // Separate main content from activities
      const { mainContent, activitiesContent } = this.separateContentFromActivities(fullText);
      
      // Parse activities if they exist
      const activities = activitiesContent ? this.parseActivities(activitiesContent, chapter.id) : [];

      // Spanish sentence segmentation for main content only
      const sentences = this.segmentSpanishSentences(mainContent);
      
      // Process each sentence for vocabulary features
      const processedSentences: ProcessedSentence[] = [];
      let globalIndex = 0;

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const words = await this.processSpanishWords(sentence, globalIndex);
        
        processedSentences.push({
          id: `${chapter.id}_sentence_${i}`,
          text: sentence,
          startIndex: globalIndex,
          endIndex: globalIndex + sentence.length,
          words
        });

        globalIndex += sentence.length + 1; // +1 for space between sentences
      }

      // Calculate word count for main content only
      const wordCount = processedSentences.reduce((sum, s) => sum + s.words.length, 0);

      return {
        ...chapter,
        sentences: processedSentences,
        wordCount,
        activities
      };
    } catch (error) {
      console.error(`Error processing chapter ${index}:`, error);
      return {
        ...chapter,
        sentences: [],
        wordCount: 0,
        activities: []
      };
    }
  }

  /**
   * Segment Spanish text into sentences using language-specific rules
   */
  private segmentSpanishSentences(text: string): string[] {
    // Clean and normalize text
    const cleanText = text
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s*([A-ZÁÉÍÓÚÑÜ])/g, '$1|$2') // Mark sentence boundaries
      .trim();

    // Split on our markers and clean up
    let sentences = cleanText.split('|').map(s => s.trim()).filter(s => s.length > 0);

    // Handle common Spanish abbreviations that shouldn't break sentences
    const spanishAbbreviations = ['Sr.', 'Sra.', 'Dr.', 'Dra.', 'etc.', 'p.ej.', 'vs.'];
    
    // Merge incorrectly split sentences due to abbreviations
    const mergedSentences: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const endsWithAbbr = spanishAbbreviations.some(abbr => 
        sentence.toLowerCase().endsWith(abbr.toLowerCase())
      );
      
      if (endsWithAbbr && i < sentences.length - 1) {
        // Merge with next sentence
        sentences[i + 1] = sentence + ' ' + sentences[i + 1];
      } else {
        mergedSentences.push(sentence);
      }
    }

    return mergedSentences.filter(s => s.length > 10); // Filter very short sentences
  }

  /**
   * Process Spanish words for vocabulary features and clickability
   */
  private async processSpanishWords(sentence: string, startIndex: number): Promise<ProcessedWord[]> {
    try {
      // Use compromise for Spanish text analysis
      const doc = compromise(sentence);
      const terms = doc.terms().out('array');
      
      const words: ProcessedWord[] = [];
      let currentIndex = startIndex;

      for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        const normalizedTerm = term.toLowerCase().replace(/[^\wáéíóúñü]/g, '');
        
        if (normalizedTerm.length > 0) {
          // Determine if word should be clickable (not a stopword, significant length)
          const clickable = !this.spanish_stopwords.has(normalizedTerm) && 
                           normalizedTerm.length > 2 &&
                           /^[a-záéíóúñü]+$/.test(normalizedTerm);

          // Get word position in sentence
          const wordStart = sentence.indexOf(term, currentIndex - startIndex);
          const wordIndex = wordStart >= 0 ? startIndex + wordStart : currentIndex;

          words.push({
            id: `word_${i}_${normalizedTerm}`,
            text: term,
            lemma: this.getSpanishLemma(normalizedTerm),
            pos: this.getPartOfSpeech(term),
            startIndex: wordIndex,
            endIndex: wordIndex + term.length,
            clickable,
            definition: clickable ? await this.getWordDefinition(normalizedTerm) : undefined
          });

          currentIndex = wordIndex + term.length + 1; // +1 for space
        }
      }

      return words;
    } catch (error) {
      console.error('Error processing Spanish words:', error);
      return [];
    }
  }

  /**
   * Get Spanish lemma (root form) of a word
   */
  private getSpanishLemma(word: string): string {
    // Use Spanish-specific stemmer
    const stemmed = natural.PorterStemmerEs.stem(word);
    
    // Handle common Spanish verb endings
    if (word.endsWith('ando') || word.endsWith('endo')) {
      return word.slice(0, -4) + 'ar'; // Gerund to infinitive approximation
    }
    if (word.endsWith('ado') || word.endsWith('ido')) {
      return word.slice(0, -3) + 'ar'; // Past participle approximation
    }
    
    return stemmed || word;
  }

  /**
   * Get basic part of speech for Spanish words
   */
  private getPartOfSpeech(word: string): string {
    const lowerWord = word.toLowerCase();
    
    // Spanish articles
    if (['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'].includes(lowerWord)) {
      return 'article';
    }
    
    // Spanish prepositions
    if (['de', 'a', 'en', 'con', 'por', 'para', 'desde', 'hasta', 'sin'].includes(lowerWord)) {
      return 'preposition';
    }
    
    // Spanish verbs (common endings)
    if (lowerWord.match(/(ar|er|ir|ando|endo|ado|ido)$/)) {
      return 'verb';
    }
    
    // Default to noun
    return 'noun';
  }

  /**
   * Get definition for a Spanish word (placeholder - integrate with dictionary API)
   */
  private async getWordDefinition(word: string): Promise<string | undefined> {
    // Placeholder - in production, integrate with Spanish dictionary API
    // For now, return undefined to indicate no definition available
    return undefined;
  }

  /**
   * Generate reading JSON format for frontend consumption
   */
  generateReadingJSON(parsedDocument: ParsedDocument): any {
    return {
      version: '1.0',
      language: 'es',
      metadata: parsedDocument.metadata,
      chapters: parsedDocument.chapters.map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        index: chapter.indexInBook,
        wordCount: chapter.wordCount,
        content: {
          sentences: chapter.sentences.map(sentence => ({
            id: sentence.id,
            text: sentence.text,
            startIndex: sentence.startIndex,
            endIndex: sentence.endIndex,
            words: sentence.words.map(word => ({
              id: word.id,
              text: word.text,
              lemma: word.lemma,
              pos: word.pos,
              startIndex: word.startIndex,
              endIndex: word.endIndex,
              clickable: word.clickable,
              ...(word.definition && { definition: word.definition }),
              ...(word.audioTimestamp && { audioTimestamp: word.audioTimestamp })
            }))
          }))
        }
      }))
    };
  }

  /**
   * Validate parsed document structure
   */
  validateParsedDocument(parsedDocument: ParsedDocument): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!parsedDocument.chapters || parsedDocument.chapters.length === 0) {
      errors.push('No chapters found in document');
    }

    for (const chapter of parsedDocument.chapters) {
      if (!chapter.title || chapter.title.trim().length === 0) {
        errors.push(`Chapter ${chapter.indexInBook} has no title`);
      }
      
      if (chapter.sentences.length === 0) {
        errors.push(`Chapter ${chapter.indexInBook} has no content`);
      }
      
      if (chapter.wordCount === 0) {
        errors.push(`Chapter ${chapter.indexInBook} has no words`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Separate main content from activities based on activity patterns
   */
  private separateContentFromActivities(fullText: string): { mainContent: string; activitiesContent: string | null } {
    // Activity pattern: Look for "Part 1" or "Part 1 –" which marks the start of activities
    const activityStartPattern = /\bPart\s+1\s*[–-]?\s*Vocabulary\s+Support/i;
    const match = fullText.match(activityStartPattern);
    
    if (match) {
      const splitIndex = match.index!;
      const mainContent = fullText.substring(0, splitIndex).trim();
      const activitiesContent = fullText.substring(splitIndex).trim();
      
      console.log(`Found activities section, split at position ${splitIndex}`);
      console.log(`Main content length: ${mainContent.length}, Activities length: ${activitiesContent.length}`);
      
      return { mainContent, activitiesContent };
    }
    
    // No activities found - return all content as main content
    console.log('No activities section found in content');
    return { mainContent: fullText, activitiesContent: null };
  }

  /**
   * Parse all activity types from activities content
   */
  private parseActivities(activitiesContent: string, chapterId: string): ChapterActivity[] {
    const activities: ChapterActivity[] = [];
    
    try {
      // Split activities by Part markers
      const activitySections = this.splitIntoActivitySections(activitiesContent);
      
      for (const [partNumber, activityType, content] of activitySections) {
        const activity = this.parseActivitySection(partNumber, activityType, content, chapterId);
        if (activity) {
          activities.push(activity);
        }
      }
      
      console.log(`Parsed ${activities.length} activities for chapter ${chapterId}`);
      return activities;
      
    } catch (error) {
      console.error('Error parsing activities:', error);
      return [];
    }
  }

  /**
   * Split activities content into individual activity sections
   */
  private splitIntoActivitySections(activitiesContent: string): Array<[number, string, string]> {
    const sections: Array<[number, string, string]> = [];
    
    // Patterns for each activity type
    const activityPatterns = [
      { part: 1, type: 'vocabulary_support', pattern: /Part\s+1\s*[–-]?\s*Vocabulary\s+Support/i },
      { part: 2, type: 'comprehension_questions', pattern: /Part\s+2\s*[–-]?\s*Comprehension\s+Questions/i },
      { part: 3, type: 'true_false', pattern: /Part\s+3\s*[–-]?\s*True\s+or\s+False/i },
      { part: 4, type: 'matching', pattern: /Part\s+4\s*[–-]?\s*Vocabulary\s+Match\s+up/i },
      { part: 5, type: 'writing_prompts', pattern: /Part\s+5\s*[–-]?\s*Writing\s+Prompts/i }
    ];
    
    // Find start positions of each activity section
    const sectionMarkers: Array<{ part: number; type: string; start: number }> = [];
    
    for (const { part, type, pattern } of activityPatterns) {
      const match = activitiesContent.match(pattern);
      if (match && match.index !== undefined) {
        sectionMarkers.push({ part, type, start: match.index });
      }
    }
    
    // Sort by start position
    sectionMarkers.sort((a, b) => a.start - b.start);
    
    // Extract content for each section
    for (let i = 0; i < sectionMarkers.length; i++) {
      const currentSection = sectionMarkers[i];
      const nextSection = sectionMarkers[i + 1];
      
      const startPos = currentSection.start;
      const endPos = nextSection ? nextSection.start : activitiesContent.length;
      
      const sectionContent = activitiesContent.substring(startPos, endPos).trim();
      sections.push([currentSection.part, currentSection.type, sectionContent]);
    }
    
    console.log(`Found ${sections.length} activity sections`);
    return sections;
  }

  /**
   * Parse individual activity section based on type
   */
  private parseActivitySection(partNumber: number, activityType: string, content: string, chapterId: string): ChapterActivity | null {
    try {
      switch (activityType) {
        case 'vocabulary_support':
          return this.parseVocabularySupport(partNumber, content, chapterId);
        case 'comprehension_questions':
          return this.parseComprehensionQuestions(partNumber, content, chapterId);
        case 'true_false':
          return this.parseTrueFalse(partNumber, content, chapterId);
        case 'matching':
          return this.parseMatching(partNumber, content, chapterId);
        case 'writing_prompts':
          return this.parseWritingPrompts(partNumber, content, chapterId);
        default:
          console.warn(`Unknown activity type: ${activityType}`);
          return null;
      }
    } catch (error) {
      console.error(`Error parsing ${activityType} activity:`, error);
      return null;
    }
  }

  /**
   * Parse Part 1: Vocabulary Support (Glossary)
   */
  private parseVocabularySupport(partNumber: number, content: string, chapterId: string): ChapterActivity {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const vocabulary: Array<{ spanish: string; english: string }> = [];
    
    for (const line of lines) {
      // Skip header lines
      if (line.includes('Part 1') || line.includes('Vocabulary Support') || line.includes('Glossary')) {
        continue;
      }
      
      // Parse vocabulary entries: "spanish = english" or "spanish → english"
      const vocabMatch = line.match(/^(.+?)\s*[=→]\s*(.+)$/);
      if (vocabMatch) {
        const spanish = vocabMatch[1].trim();
        const english = vocabMatch[2].trim();
        vocabulary.push({ spanish, english });
      }
    }
    
    console.log(`Parsed ${vocabulary.length} vocabulary items`);
    
    return {
      activityType: 'vocabulary_support',
      title: 'Vocabulary Support',
      description: 'Glossary of key vocabulary words from the chapter',
      activityData: { vocabulary },
      sortOrder: partNumber
    };
  }

  /**
   * Parse Part 2: Comprehension Questions
   */
  private parseComprehensionQuestions(partNumber: number, content: string, chapterId: string): ChapterActivity {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const questions: string[] = [];
    
    for (const line of lines) {
      // Skip header lines and instructions
      if (line.includes('Part 2') || line.includes('Comprehension Questions') || 
          line.includes('Answer in') || line.includes('words')) {
        continue;
      }
      
      // Questions typically end with ? 
      if (line.endsWith('?') && line.length > 10) {
        questions.push(line);
      }
    }
    
    console.log(`Parsed ${questions.length} comprehension questions`);
    
    return {
      activityType: 'comprehension_questions',
      title: 'Comprehension Questions',
      description: 'Questions to test understanding of the chapter content',
      activityData: { questions },
      sortOrder: partNumber
    };
  }

  /**
   * Parse Part 3: True or False
   */
  private parseTrueFalse(partNumber: number, content: string, chapterId: string): ChapterActivity {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const statements: Array<{ statement: string; answer?: boolean }> = [];
    
    for (const line of lines) {
      // Skip header lines and instructions
      if (line.includes('Part 3') || line.includes('True or False') || 
          line.includes('Write T') || line.includes('false')) {
        continue;
      }
      
      // Statements are typically sentences without question marks
      if (!line.endsWith('?') && line.length > 10 && !line.includes('Part')) {
        statements.push({ statement: line });
      }
    }
    
    console.log(`Parsed ${statements.length} true/false statements`);
    
    return {
      activityType: 'true_false',
      title: 'True or False',
      description: 'Determine if statements about the chapter are true or false',
      activityData: { statements },
      sortOrder: partNumber
    };
  }

  /**
   * Parse Part 4: Vocabulary Match up activity
   */
  private parseMatching(partNumber: number, content: string, chapterId: string): ChapterActivity {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const matchingPairs: Array<{ spanish: string; english: string; number?: number }> = [];
    
    let currentSpanish = '';
    let currentEnglish = '';
    let currentNumber: number | undefined = undefined;
    
    for (const line of lines) {
      // Skip header lines
      if (line.includes('Part 4') || line.includes('Match') || line.includes('Spanish') || 
          line.includes('English') || line.includes('numbers') || line.includes('boxes')) {
        continue;
      }
      
      // Look for numbered items
      const numberMatch = line.match(/^(\d+)$/);
      if (numberMatch) {
        currentNumber = parseInt(numberMatch[1]);
        continue;
      }
      
      // Spanish words typically come after numbers
      if (currentNumber && line.length > 2 && !currentSpanish) {
        currentSpanish = line;
        continue;
      }
      
      // English words/meanings
      if (currentSpanish && line.length > 2) {
        currentEnglish = line;
        matchingPairs.push({ 
          spanish: currentSpanish, 
          english: currentEnglish, 
          number: currentNumber 
        });
        currentSpanish = '';
        currentEnglish = '';
        currentNumber = undefined;
      }
    }
    
    console.log(`Parsed ${matchingPairs.length} matching pairs`);
    
    return {
      activityType: 'matching',
      title: 'Vocabulary Match Up',
      description: 'Match Spanish words with their English meanings',
      activityData: { matchingPairs },
      sortOrder: partNumber
    };
  }

  /**
   * Parse Part 5: Writing Prompts
   */
  private parseWritingPrompts(partNumber: number, content: string, chapterId: string): ChapterActivity {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const prompts: string[] = [];
    
    for (const line of lines) {
      // Skip header lines
      if (line.includes('Part 5') || line.includes('Writing Prompts') || 
          line.includes('Write short sentences') || line.includes('per question')) {
        continue;
      }
      
      // Writing prompts are typically imperative sentences or questions
      if (line.length > 15 && (line.includes('Write') || line.includes('Imagine') || line.endsWith('?'))) {
        prompts.push(line);
      }
    }
    
    console.log(`Parsed ${prompts.length} writing prompts`);
    
    return {
      activityType: 'writing_prompts',
      title: 'Writing Prompts',
      description: 'Creative writing exercises to practice Spanish',
      activityData: { prompts },
      sortOrder: partNumber
    };
  }
}

export default DocumentParser;