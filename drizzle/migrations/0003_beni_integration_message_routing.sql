ALTER TABLE public.linq_messages ADD COLUMN recipient_phone text;
ALTER TABLE public.linq_messages ADD COLUMN reply_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.linq_messages ADD COLUMN reply_error text;
CREATE INDEX linq_replies_pending ON public.linq_messages(reply_status,created_at);
CREATE INDEX linq_chat_routing ON public.linq_messages(chat_id,recipient_phone);