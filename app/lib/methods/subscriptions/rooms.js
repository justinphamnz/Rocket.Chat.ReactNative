import database from '../../realm';
import { merge } from '../helpers/mergeSubscriptionsRooms';

export default function subscribeRooms(id) {
	this.ddp.subscribe('stream-notify-user', `${ id }/subscriptions-changed`, false);
	this.ddp.subscribe('stream-notify-user', `${ id }/rooms-changed`, false);

	let timer = null;
	const loop = (time = new Date()) => {
		if (timer) {
			return;
		}
		timer = setTimeout(async() => {
			timer = false;
			try {
				await this.getRooms(time);
				loop();
			} catch (e) {
				loop(time);
			}
		}, 5000);
	};

	this.ddp.on('logged', () => {
		clearTimeout(timer);
		timer = false;
	});

	this.ddp.on('logout', () => {
		clearTimeout(timer);
		timer = true;
	});

	this.ddp.on('disconnected', () => { loop(); });

	this.ddp.on('stream-notify-user', (ddpMessage) => {
		try {
			const [type, data] = ddpMessage.fields.args;
			const [, ev] = ddpMessage.fields.eventName.split('/');
			if (/subscriptions/.test(ev)) {
				const tpm = merge(data);
				return database.write(() => {
					database.create('subscriptions', tpm, true);
				});
			}
			if (/rooms/.test(ev) && type === 'updated') {
				const [sub] = database.objects('subscriptions').filtered('rid == $0', data._id);
				database.write(() => {
					merge(sub, data);
				});
			}
		} catch (e) {
			console.warn('stream-notify-user', e);
		}
	});
}
