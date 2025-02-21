import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as mongodb from 'mongodb';
import { MongoUtils, N9MongoLock } from '../../src';

global.log = new N9Log('tests').module('lock-fields');

test.before(async () => {
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
});

test('[LOCK] Test a simple lock', async (t: Assertions) => {
	const codeRegexp = new RegExp(/^[0-9a-f]{32}$/);
	const n9MongoLock = new N9MongoLock();

	await n9MongoLock.ensureIndexes();

	const code = await n9MongoLock.acquire();
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	const code2 = await n9MongoLock.acquire();
	t.falsy(code2, 'However, no code was returned since the lock was not acquired');

	const isReleased = await n9MongoLock.release(code);
	t.truthy(isReleased, 'Lock is released by calling function release');

	const code3 = await n9MongoLock.acquire();
	t.truthy(code3.match(codeRegexp), 'Get the lock another time');
});

test('[LOCK] Test lock token and released later', async (t: Assertions) => {
	const codeRegexp = new RegExp(/^[0-9a-f]{32}$/);
	const n9MongoLock = new N9MongoLock('another-collection' + Date.now());

	await n9MongoLock.ensureIndexes();

	const code = await n9MongoLock.acquire();
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');
	// release this lock in 3s
	setTimeout(() => n9MongoLock.release(code), 3000);

	const code2 = await n9MongoLock.acquireBlockingUntilAvailable(5000);
	t.truthy(code2.match(codeRegexp), 'Get the lock after waiting');
});
