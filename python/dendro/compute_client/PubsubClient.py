from typing import List
import queue
from pubnub.pnconfiguration import PNConfiguration
from pubnub.callbacks import SubscribeCallback
from pubnub.pubnub import PubNub

class MySubscribeCallback(SubscribeCallback):
    def __init__(self, message_queue: queue.Queue):
        self._message_queue = message_queue
    def message(self, pubnub, message):
        msg = message.message
        self._message_queue.put(msg)

class PubsubClient:
    def __init__(self, *,
        pubnub_subscribe_key: str,
        pubnub_channel: str,
        pubnub_user: str,
        compute_client_id: str
    ):
        self._message_queue = queue.Queue()
        pnconfig = PNConfiguration()
        pnconfig.subscribe_key = pubnub_subscribe_key # type: ignore (not sure why we need to type ignore this)
        pnconfig.user_id = pubnub_user
        pnconfig.uuid = compute_client_id
        self._pubnub = PubNub(pnconfig)
        self._listener = MySubscribeCallback(message_queue=self._message_queue)
        self._pubnub.add_listener(self._listener)
        self._pubnub.subscribe().channels([pubnub_channel]).execute()
    def take_messages(self) -> List[dict]:
        ret = []
        while True:
            try:
                msg = self._message_queue.get(block=False)
                ret.append(msg)
            except queue.Empty:
                break
        return ret
    def close(self):
        self._pubnub.unsubscribe_all()
        self._pubnub.stop()
        self._pubnub.remove_listener(self._listener)
        # unfortunately this doesn't actually kill the thread
        # I submitted a ticket to pubnub about this
        # and they acknowledged that it's a problem
        # but they don't seem to be fixing it

# from typing import List
# import json
# import queue
# from ..common.api_requests import get_pubsub_subscription
# import websocket
# import threading


# class PubsubClient:
#     def __init__(self, *,
#         compute_client_id: str,
#         compute_client_private_key: str,
#     ):
#         self._message_queue = queue.Queue()
#         self._websocket_thread = _open_websocket_connection(
#             compute_client_id=compute_client_id,
#             compute_client_private_key=compute_client_private_key,
#             message_queue=self._message_queue
#         )
#     def take_messages(self) -> List[dict]:
#         ret = []
#         while True:
#             try:
#                 msg = self._message_queue.get(block=False)
#                 ret.append(msg)
#             except queue.Empty:
#                 break
#         return ret


# def _open_websocket_connection(*,
#     compute_client_id,
#     compute_client_private_key,
#     message_queue: queue.Queue
# ):
#     # We do this first just to get the pubsub url
#     pubsub_subscription = get_pubsub_subscription(
#         compute_client_id=compute_client_id,
#         compute_client_private_key=compute_client_private_key
#     )
#     ephemeri_pubsub_url = pubsub_subscription['ephemeriPubsubUrl']
#     if ephemeri_pubsub_url.startswith('http://'):
#         ephemeri_pubsub_websocket_url = 'ws://' + ephemeri_pubsub_url[len('http://'):]
#     elif ephemeri_pubsub_url.startswith('https://'):
#         ephemeri_pubsub_websocket_url = 'wss://' + ephemeri_pubsub_url[len('https://'):]
#     else:
#         raise Exception('Unexpected ephemeri_pubsub_url: ' + ephemeri_pubsub_url)

#     def on_message(ws, message_json):
#         try:
#             message = json.loads(message_json)
#         except Exception as e:
#             print('Error parsing message:', e)
#             print('Message:', message_json)
#             return

#         if 'type' in message:
#             if message['type'] == 'pubsubMessage':
#                 message_queue.put(message)

#     def on_error(ws, error):
#         print('Websocket error:', error)

#     def on_close(ws, close_status_code, close_msg):
#         print('Websocket closed:', close_status_code, close_msg)

#     def on_open(ws):
#         # on each open we need to get the subscription request and send it
#         pubsub_subscription = get_pubsub_subscription(
#             compute_client_id=compute_client_id,
#             compute_client_private_key=compute_client_private_key
#         )
#         ephemeri_pubsub_url_new = pubsub_subscription['ephemeriPubsubUrl']
#         if ephemeri_pubsub_url_new != ephemeri_pubsub_url:
#             raise Exception('Mismatch in ephemeriPubsubUrl: ' + ephemeri_pubsub_url + ' ' + ephemeri_pubsub_url_new)
#         ephemeri_pubsub_subscribe_request = pubsub_subscription['ephemeriPubsubSubscribeRequest']

#         ws.send(json.dumps(ephemeri_pubsub_subscribe_request))

#     def run_websocket():
#         ws = websocket.WebSocketApp(ephemeri_pubsub_websocket_url,
#             on_message=on_message,
#             on_error=on_error,
#             on_close=on_close
#         )
#         ws.on_open = on_open
#         ws.run_forever(
#             ping_interval=60,
#             ping_timeout=20,
#             ping_payload='ping'
#         )

#     thread = threading.Thread(target=run_websocket)
#     thread.daemon = True
#     thread.start()

#     return thread
