
import os

from telegram import Bot


async def send_message(chat_id: str, message: str ):
    bot = Bot(token=os.getenv("TELEGRAM_API_KEY"))
    await bot.send_message(chat_id=chat_id, text=message)
    

async def get_chat_groups()->list[dict]:
    return [
        {
            'chat_id':os.getenv("TELEGRAM_CHAT_ID"),
            'name':'chat'
        }
    ]
