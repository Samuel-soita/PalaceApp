/** Mirror of backend devotion affirmation extraction for offline-first publishing. */
export function extractAffirmationFromContent(content: string): string {
    const sentences = content.split(/[.!?]/).filter((s) => s.trim().length > 10);
    const keywords = ['I am', 'I will', 'You are', 'manifest', 'favor', 'blessed', 'victorious', 'established', 'Word', 'Lord'];

    let bestSentence = sentences[0] || 'I am walking in divine favor today.';
    let maxMatches = 0;

    for (const sentence of sentences) {
        let matches = 0;
        for (const kw of keywords) {
            if (sentence.toLowerCase().includes(kw.toLowerCase())) matches++;
        }
        if (matches > maxMatches) {
            maxMatches = matches;
            bestSentence = sentence.trim();
        }
    }

    return `${bestSentence}!`;
}
