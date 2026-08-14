begin;

create or replace function kinavela_private.enforce_notification_mute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.notification_kind in ('village_activity','support_response')
     and new.payload ? 'village_id'
     and exists (
       select 1
       from public.conversations conversation
       join public.conversation_participants participant
         on participant.conversation_id=conversation.id
       where conversation.village_id=(new.payload->>'village_id')::uuid
         and participant.profile_id=new.recipient_profile_id
         and participant.muted_at is not null
     ) then
    return null;
  end if;
  return new;
exception when invalid_text_representation then
  raise exception 'invalid_notification_village';
end;
$$;

revoke all on function kinavela_private.enforce_notification_mute()
from public, anon, authenticated, service_role;

drop trigger if exists notification_outbox_enforce_mute
on public.notification_outbox;
create trigger notification_outbox_enforce_mute
before insert on public.notification_outbox
for each row execute function kinavela_private.enforce_notification_mute();

insert into kinavela_private.schema_migrations(version)
values('202608130021_notification_mute_enforcement')
on conflict(version) do nothing;

notify pgrst,'reload schema';
commit;
