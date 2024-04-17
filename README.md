# Telegram Bot for message newsletter via another bots

Bot link: https://t.me/postman12_bot

## Commands:

* add_message
> Saves message in the database for later sending. Supports images, albums (several images in one message) and links.
> You can enclose text in asterisk like \*Lorem Ipsum\* to mark it as message subject.
> Message subject will be specified in message listing and formatted as bold within message.
* add_bot
> Adds specified bot to the list. Accepts bot token. If specified token is invalid then it will not be stored.
* add_recievers
> Accepts csv file with Telegram id of users that will recieve messages.

*Messages, bots and recievers are limited by 9 entries. After this add commands will delete first entry in order to free space.*

For all add commands there are according list commands that will print out all saved entries. They are:
* list_messages
* list_bots
* list_recievers

Newsletter commands:
* create_newsletter
> Must be called after adding at least one entry to each of messages, bots and recievers.
> User has to choose what messages, bots and recievers will be used in this newsletter.
> It is possible to choose multiple entries from each category.
* send_newsletter
> Must be called after create_newsletter call. Sends specified messeges to recievers via bots.
