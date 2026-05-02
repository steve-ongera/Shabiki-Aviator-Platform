"""
core/consumers.py
Django Channels WebSocket consumer — real-time game events + live chat.
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from decimal import Decimal

logger = logging.getLogger(__name__)

GAME_GROUP = "game_room"
CHAT_GROUP = "chat_room"


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        await self.channel_layer.group_add(GAME_GROUP, self.channel_name)
        await self.channel_layer.group_add(CHAT_GROUP, self.channel_name)
        await self.accept()
        # Send current game state on connect
        state = await self.get_current_state()
        await self.send(text_data=json.dumps({"type": "game.state", **state}))
        # Send recent chat
        messages = await self.get_recent_chat()
        await self.send(text_data=json.dumps({"type": "chat.history", "messages": messages}))

    async def disconnect(self, code):
        await self.channel_layer.group_discard(GAME_GROUP, self.channel_name)
        await self.channel_layer.group_discard(CHAT_GROUP, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")

        if msg_type == "chat.send":
            if self.user and self.user.is_authenticated:
                message = str(data.get("message", "")).strip()[:300]
                if message:
                    await self.save_chat(message)
                    await self.channel_layer.group_send(
                        CHAT_GROUP,
                        {
                            "type": "chat.message",
                            "username": self.user.username,
                            "message": message,
                        },
                    )

        elif msg_type == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    # ── Group message handlers (called by channel layer) ──────────────────────

    async def game_state(self, event):
        await self.send(text_data=json.dumps({"type": "game.state", **event}))

    async def game_tick(self, event):
        await self.send(text_data=json.dumps({"type": "game.tick", **event}))

    async def game_crash(self, event):
        await self.send(text_data=json.dumps({"type": "game.crash", **event}))

    async def game_betting(self, event):
        await self.send(text_data=json.dumps({"type": "game.betting", **event}))

    async def players_update(self, event):
        await self.send(text_data=json.dumps({"type": "players.update", **event}))

    async def bet_result(self, event):
        # Only forward to the relevant user
        if self.user and str(self.user.id) == event.get("user_id"):
            await self.send(text_data=json.dumps({"type": "bet.result", **event}))

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "chat.message",
                    "username": event["username"],
                    "message": event["message"],
                }
            )
        )

    async def live_play(self, event):
        """Broadcast cashout / bet events to live-feed panel."""
        await self.send(text_data=json.dumps({"type": "live.play", **event}))

    # ── DB helpers ────────────────────────────────────────────────────────────

    @database_sync_to_async
    def get_current_state(self):
        from .models import GameRound, Bet
        try:
            rnd = GameRound.objects.exclude(status="crashed").latest("created_at")
            bets = list(
                rnd.bets.select_related("user").values(
                    "user__username", "amount", "status", "cashout_multiplier", "auto_cashout"
                )
            )
            players = [
                {
                    "username": b["user__username"],
                    "bet": str(b["amount"]),
                    "status": b["status"],
                    "cashout": str(b["cashout_multiplier"]) if b["cashout_multiplier"] else None,
                    "auto_cashout": str(b["auto_cashout"]) if b["auto_cashout"] else None,
                }
                for b in bets
            ]
            return {
                "status": rnd.status,
                "multiplier": str(rnd.current_multiplier),
                "round_id": str(rnd.id),
                "crash_point": str(rnd.crash_point) if rnd.crash_point else None,
                "players": players,
            }
        except GameRound.DoesNotExist:
            return {"status": "waiting", "multiplier": "1.00", "round_id": None, "players": []}

    @database_sync_to_async
    def get_recent_chat(self):
        from .models import ChatMessage
        msgs = list(
            ChatMessage.objects.select_related("user")
            .order_by("-created_at")[:30]
        )
        msgs.reverse()
        return [
            {"username": m.user.username, "message": m.message, "ts": m.created_at.isoformat()}
            for m in msgs
        ]

    @database_sync_to_async
    def save_chat(self, message):
        from .models import ChatMessage
        ChatMessage.objects.create(user=self.user, message=message)