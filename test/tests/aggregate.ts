import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as mongodb from 'mongodb';
import { AggregationCursor } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

class AggregationResult {
	public _id: string;
	public count: number;
}

global.log = new N9Log('tests');

let mongod: MongoMemoryServer;

test.before(async () => {
	mongod = new MongoMemoryServer();
	const uri = await mongod.getConnectionString();
	await MongoUtils.connect(uri);
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
	await mongod.stop();
});

test('[AGG] Insert some and aggregate it', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, null);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');

	const sizeWithElementIn = await mongoClient.count();
	t.is(sizeWithElementIn, 5, 'nb element in collection');

	const aggResult = await mongoClient.aggregate<AggregationResult>([{
		$group: {
			_id: '$field1String',
			count: { $sum: 1 },
		},
	}, {
		$sort: {
			count: -1,
		},
	}]);

	t.truthy(aggResult instanceof AggregationCursor, 'return  AggregationCursor');
	const aggResultAsArray = await aggResult.toArray();

	t.is(aggResultAsArray.length, 2, 'nb element aggregated is 2');

	t.deepEqual(aggResultAsArray, [{ _id: 'string2', count: 3 }, { _id: 'string1', count: 2 }], 'All is exactly right');
	await mongoClient.dropCollection();
});
