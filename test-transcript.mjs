import { YoutubeTranscript } from 'youtube-transcript';

const videoId = 'zDeoQnawX7I';

console.log('Testing youtube-transcript library...');
console.log('Video ID:', videoId);

try {
  console.log('\nAttempt 1: with lang=ja');
  const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ja' });
  console.log('Success! Got', transcript.length, 'segments');
  console.log('First segment:', transcript[0]);
} catch (error) {
  console.log('Failed:', error.message);
}

try {
  console.log('\nAttempt 2: without lang');
  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  console.log('Success! Got', transcript.length, 'segments');
  console.log('First segment:', transcript[0]);
} catch (error) {
  console.log('Failed:', error.message);
}
