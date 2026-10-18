import {test} from 'node:test';import assert from 'node:assert/strict';
import {cleanLink,sameLink,isFbUrl,looksLikePost,isLive,todayYmd,parseYmd,addDays,csvCell} from '../src/lib/domain.js';
test('Facebook host validation rejects deceptive hosts, script URLs and embedded credentials',()=>{
 for(const url of ['javascript:alert(1)','https://facebook.com.evil.test/posts/1','https://facebook.com@evil.test/posts/1','https://attacker@facebook.com/posts/1'])assert.equal(isFbUrl(url),false,url);
 assert.equal(isFbUrl('https://m.facebook.com/ubei/posts/ABC'),true);
});
test('link cleaning removes tracking, normalizes mobile hosts, sorts query parameters and preserves token case',()=>{
 assert.equal(cleanLink('http://m.facebook.com/share/p/AbC/?utm_source=ad&fbclid=123#x'),'https://www.facebook.com/share/p/AbC');
 assert.equal(sameLink('https://www.facebook.com/share/p/AbC','https://www.facebook.com/share/p/abc'),false);
 assert.equal(sameLink('https://m.facebook.com/story.php?story_fbid=ABC&id=1&fbclid=xyz','https://www.facebook.com/story.php?id=1&story_fbid=ABC'),true);
});
test('profile and group home URLs do not count as shared posts',()=>{
 for(const u of ['https://facebook.com/ubei','https://facebook.com/groups/123','https://facebook.com/profile.php?id=1','https://facebook.com/pages/name'])assert.equal(looksLikePost(u),false,u);
 for(const u of ['https://facebook.com/groups/123/posts/456','https://facebook.com/share/p/AbC','https://facebook.com/reel/123','https://facebook.com/ubei/posts/AbC','https://facebook.com/permalink.php?story_fbid=AbC&id=123'])assert.equal(looksLikePost(u),true,u);
});
test('publishing and calendar dates follow Dhaka, including the midnight boundary',()=>{
 assert.equal(todayYmd(new Date('2026-10-17T18:30:00Z')),'2026-10-18');
 const post={date:'2026-10-18',time:'09:30'};
 assert.equal(isLive(post,new Date('2026-10-18T03:29:59Z').getTime()),false);
 assert.equal(isLive(post,new Date('2026-10-18T03:30:00Z').getTime()),true);
 assert.equal(addDays('2024-02-28',1),'2024-02-29');assert.throws(()=>parseYmd('2026-02-30'));
});
test('CSV quotes multiline cells and neutralizes formula injection even with leading spaces',()=>{
 assert.equal(csvCell(' =SUM(A1:A2)'),"' =SUM(A1:A2)");assert.equal(csvCell('@cmd'),"'@cmd");assert.equal(csvCell('x,"y"'),'"x,""y"""');assert.equal(csvCell(42),'42');
});
