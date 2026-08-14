begin;

alter table public.cultural_missions
  add column cultural_context text,
  add column materials text[] not null default '{}'::text[],
  add column guardian_guidance text,
  add column respectful_attribution text,
  add column passport_reflection_prompt text,
  add column context_scope text not null default 'country'
    check (context_scope in ('country', 'community', 'family')),
  add column review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'reviewed', 'retired')),
  add column reviewed_at timestamptz,
  add column content_version smallint not null default 1
    check (content_version between 1 and 32767);

-- Existing or operator-created content is kept, but unpublished until its new
-- context, safeguarding and attribution fields have been deliberately reviewed.
update public.cultural_missions
set active = false
where review_status <> 'reviewed';

do $seed$
declare
  mission jsonb;
  step jsonb;
  step_position smallint;
  content jsonb := $content$
  [
    {
      "id":"a1000000-0000-4000-8000-000000000001",
      "slug":"five-greetings-from-cameroon",
      "title":"Carry five family greetings forward",
      "summary":"Learn greetings through a trusted speaker and practise when each one belongs.",
      "description":"Choose greetings connected to your family's Cameroonian roots. Record pronunciation only with permission, learn who uses each greeting and avoid presenting one language as representative of all Cameroon.",
      "category":"language","culture_id":"20000000-0000-4000-8000-000000000001","min_age":3,"max_age":18,"minutes":35,"scope":"country",
      "context":"Cameroon is multilingual. This country-level activity asks each family to name the specific language and community behind every greeting rather than blending distinct traditions together.",
      "materials":["Paper or a private family note","A trusted speaker or family-approved recording","Pencil or crayons"],
      "guidance":"Let the speaker choose what may be recorded. Never pressure a child to perform unfamiliar sounds, and do not upload another person's voice without consent.",
      "attribution":"Credit the person, language and community that taught each greeting, using only the name or relationship they agree to share.",
      "reflection":"Which greeting do you want to remember, who taught it to you, and when will your family use it?",
      "steps":[["Ask and identify","Ask a trusted speaker for five greetings and write down the language, community and setting for each."],["Listen with permission","Listen slowly and notice pronunciation and tone; record only when the speaker explicitly agrees."],["Practise in context","Role-play the situations in which each greeting is appropriate and let everyone participate comfortably."],["Pass it forward","Use one greeting with a trusted relative and capture what your family wants to remember."]]
    },
    {
      "id":"a1000000-0000-4000-8000-000000000002",
      "slug":"family-recipe-table",
      "title":"Cook a recipe and trace its story",
      "summary":"Prepare one family dish while learning where its ingredients, name and memories come from.",
      "description":"Choose a Cameroonian family recipe, cook it together and distinguish your household's version from the many regional and community variations that may share a name.",
      "category":"cooking","culture_id":"20000000-0000-4000-8000-000000000001","min_age":3,"max_age":18,"minutes":100,"scope":"country",
      "context":"Food traditions vary by region, community, faith, season and household. The family's own source is the centre of this activity; no single recipe is described as the definitive Cameroonian version.",
      "materials":["A family recipe or conversation with a trusted cook","Ingredients and age-appropriate kitchen tools","Paper or a private family note"],
      "guidance":"An adult handles heat, knives and allergens. Ask before preserving someone else's recipe or story, and note substitutions made in Germany without judging them as less authentic.",
      "attribution":"Name the relative, cook, household or community source with permission, and distinguish their version from your family's adaptations.",
      "reflection":"What taste, person or place should your family remember from this recipe, and what did you adapt?",
      "steps":[["Choose the source","Ask who taught the recipe, where your family's version is made and when it is usually served."],["Prepare safely","Assign age-appropriate jobs and let an adult manage heat, knives and allergy checks."],["Trace one ingredient","Choose one ingredient and discuss where the family finds it in Germany and what substitutes are possible."],["Share the memory","Eat together and record the recipe source, one adaptation and one family memory."]]
    },
    {
      "id":"a1000000-0000-4000-8000-000000000003",
      "slug":"map-a-family-journey",
      "title":"Map Cameroon through family connections",
      "summary":"Explore regions and places through the people, languages and memories your family connects to them.",
      "description":"Use a simple map to locate Cameroon, neighbouring countries and several family-connected places. Keep exact homes and travel details private while learning that geography and cultural identity are related but not interchangeable.",
      "category":"geography","culture_id":"20000000-0000-4000-8000-000000000001","min_age":6,"max_age":18,"minutes":50,"scope":"country",
      "context":"This is a country-level geography activity. It makes room for different regions, languages, cities and rural places without turning administrative boundaries into claims about a person's identity.",
      "materials":["A paper map or offline map image","Paper, pencils and removable markers","Family-approved place names"],
      "guidance":"Use city or region names rather than private addresses. Adults should decide which migration or travel memories are comfortable to discuss and save.",
      "attribution":"Credit place knowledge to the family or trusted source that shared it, and label uncertain memories as questions rather than facts.",
      "reflection":"Which place on the map feels important to your family, and what question would you like to ask about it?",
      "steps":[["Find the wider region","Locate Cameroon, its neighbouring countries and Germany without ranking places as more or less important."],["Add family places","Mark only family-approved cities, regions or landscape features; never add a private address."],["Connect language and place","Add languages or community names only where your source makes that connection, noting that people move."],["Tell one map story","Choose one place, share a memory or question and save a privacy-safe reflection."]]
    },
    {
      "id":"a1000000-0000-4000-8000-000000000004",
      "slug":"family-song-and-rhythm",
      "title":"Learn a Duala song, rhythm or movement",
      "summary":"Follow a trusted Duala family or community source to learn how one piece is used and remembered.",
      "description":"Choose a song, rhythm or movement your trusted source identifies as Duala. Learn its setting and meaning before making a family response, and never treat one example as standing for every Duala person.",
      "category":"music","culture_id":"20000000-0000-4000-8000-000000000005","min_age":3,"max_age":18,"minutes":45,"scope":"community",
      "context":"Duala musical and movement practices are living and varied. This activity deliberately relies on a named family or community source instead of prescribing a supposedly universal performance.",
      "materials":["A family-approved song or demonstration","A safe open space","Optional household percussion"],
      "guidance":"Check volume, movement space and physical accessibility. Ask before recording, copying or sharing a person's voice, image or performance.",
      "attribution":"Name the Duala source and the occasion or setting they describe, with their permission; do not relabel commercial recordings as family-owned material.",
      "reflection":"What did your source want you to understand about this sound or movement, and how will you credit them?",
      "steps":[["Ask about the setting","Learn who shared the piece, when it is used and whether any part should remain private."],["Listen and observe","Notice rhythm, words or movement before trying it; ask about meanings you do not know."],["Respond together","Create an age-appropriate family response without claiming to reproduce a formal performance."],["Credit the source","Record what you learned, the permitted attribution and what must not be shared."]]
    },
    {
      "id":"a1000000-0000-4000-8000-000000000005",
      "slug":"teach-a-family-game",
      "title":"Teach a traditional game from your family",
      "summary":"Learn a game through a family source, including its local name, rules and variations.",
      "description":"Ask a relative or trusted community member to teach a game they connect with childhood in Cameroon. Compare rule variations respectfully and adapt only for safety, access and available space.",
      "category":"games","culture_id":"20000000-0000-4000-8000-000000000001","min_age":4,"max_age":18,"minutes":45,"scope":"family",
      "context":"Games travel and change between households and communities. This activity documents one person's version instead of assigning a single origin or fixed national rule set without evidence.",
      "materials":["A trusted person who knows the game","A safe play area","Simple game pieces chosen by the source"],
      "guidance":"An adult checks space, equipment, contact and age suitability. Make access adaptations openly and avoid mocking names, accents or unfamiliar rules.",
      "attribution":"Record who taught this version, what they call it and any community or place connection they choose to name.",
      "reflection":"What rule, word or moment made this version special to the person who taught you?",
      "steps":[["Invite the teacher","Ask a trusted person to choose a game and explain what they call it and where they played it."],["Set safe rules","Review the play space, demonstrate the rules and agree on age or access adaptations."],["Play two rounds","Try the taught version, then discuss rather than correct any rule differences family members remember."],["Remember the version","Save the teacher's permitted attribution, the rules you used and one favourite moment."]]
    },
    {
      "id":"a1000000-0000-4000-8000-000000000006",
      "slug":"bassa-family-folktale",
      "title":"Carry a Bassa family story with care",
      "summary":"Listen to a story from a trusted Bassa source and preserve its teller, context and unanswered questions.",
      "description":"Invite a trusted Bassa relative or community member to choose a folktale or family story they are comfortable sharing. Focus on how this teller learned and understands it rather than searching for one authoritative version.",
      "category":"storytelling","culture_id":"20000000-0000-4000-8000-000000000003","min_age":5,"max_age":18,"minutes":50,"scope":"community",
      "context":"Oral stories can have multiple tellers, versions and permissions. This Bassa-focused activity keeps the teller and their account visible and does not publish sacred, restricted or family-private material.",
      "materials":["A trusted storyteller","A quiet listening space","Paper or a private recording with permission"],
      "guidance":"The teller decides whether recording is allowed and what may be repeated. Stop if the story is frightening or unsuitable for the child's age, and never invent missing cultural meaning.",
      "attribution":"Credit the teller and the Bassa context they name, using their preferred wording and only the identity details they permit.",
      "reflection":"Who told this version, what did it make you wonder, and what permission did they give for keeping it?",
      "steps":[["Agree on permission","Ask the teller what may be listened to, recorded, retold or kept only within the family."],["Listen without interrupting","Hear the full story first and save questions for the end unless the teller invites them."],["Ask about this version","Learn when the teller heard it, what it means to them and whether other versions are known."],["Reflect, do not flatten","Save the teller's attribution, one reflection and any limits on future sharing."]]
    },
    {
      "id":"a1000000-0000-4000-8000-000000000007",
      "slug":"cameroon-history-family-timeline",
      "title":"Build a Cameroon family-history timeline",
      "summary":"Place family memories beside carefully sourced public events without turning one family's story into national history.",
      "description":"Choose a short period connected to your family, add two or three public historical events from a trusted museum, archive, library or school source, and place family memories alongside them with clear labels.",
      "category":"history","culture_id":"20000000-0000-4000-8000-000000000001","min_age":9,"max_age":18,"minutes":75,"scope":"country",
      "context":"Cameroon's histories include many communities and perspectives. Family memory and published historical evidence are both valuable but different kinds of sources, so the timeline labels each clearly.",
      "materials":["Paper or timeline cards","A trusted museum, archive, library or school source","Family-approved memories"],
      "guidance":"Adults choose age-appropriate material, especially for colonialism, conflict or displacement. Do not ask relatives to revisit painful events, and keep sensitive dates or locations private.",
      "attribution":"Write down the title and institution for each public source and name family contributors only with consent; mark uncertainty explicitly.",
      "reflection":"Which family memory changed how you understood a public event, and what source would you explore next?",
      "steps":[["Choose a small period","Select a manageable time window and one question rather than attempting a complete national history."],["Find public sources","Use two or three age-appropriate museum, archive, library or school sources and record where each claim came from."],["Add family memory","Invite an optional family memory and label it separately from published historical evidence."],["Review the timeline","Look for missing perspectives, mark open questions and save a reflection without sensitive personal details."]]
    },
    {
      "id":"a1000000-0000-4000-8000-000000000008",
      "slug":"bamileke-family-celebration",
      "title":"Document a Bamiléké family celebration",
      "summary":"Explore how one Bamiléké family marks an important occasion and what should remain private.",
      "description":"Choose an occasion a trusted Bamiléké family source is comfortable discussing. Learn about preparations, people, objects, food, language or music while recognizing variation among Bamiléké communities and households.",
      "category":"traditions","culture_id":"20000000-0000-4000-8000-000000000002","min_age":6,"max_age":18,"minutes":55,"scope":"community",
      "context":"Bamiléké is not a single uniform household tradition. This activity documents one family account and explicitly avoids generalizing private, sacred or community-specific practices.",
      "materials":["A trusted family source","Paper or private family note","Optional family-approved object or photo"],
      "guidance":"The source chooses the occasion and privacy boundary. Do not recreate sacred roles, clothing, objects or ceremonies as play, and never upload identifiable images without consent.",
      "attribution":"Describe this as the named family's account, credit contributors with permission and record any element they say must remain private.",
      "reflection":"Which preparation or value matters most in your family's account, and what should future readers understand about its privacy?",
      "steps":[["Choose an occasion","Let the family source choose an occasion and explain what is appropriate for children to learn."],["Map the preparation","List several preparations or roles without copying restricted ceremonial knowledge."],["Notice family variation","Ask what belongs to this household or community and what should not be generalized."],["Preserve respectfully","Save a permitted memory, attribution and explicit sharing boundary."]]
    },
    {
      "id":"a1000000-0000-4000-8000-000000000009",
      "slug":"beti-words-and-family-values",
      "title":"Explore Beti words for family values",
      "summary":"Ask a trusted Beti speaker how particular words express values in their family and language.",
      "description":"Choose two or three values your family discusses, then ask a trusted Beti speaker whether there are related words, expressions or stories in the specific language they speak. Keep translation uncertainty visible.",
      "category":"family","culture_id":"20000000-0000-4000-8000-000000000004","min_age":7,"max_age":18,"minutes":45,"scope":"community",
      "context":"Beti includes distinct people and languages, and neither a word nor a value has one universal family meaning. The speaker names their language and explains their own usage.",
      "materials":["A trusted Beti-language speaker","Value cards or slips of paper","A private family note"],
      "guidance":"Avoid testing or correcting the speaker with automatic translation. Children may disagree with an interpretation; use that difference as a respectful family conversation, not a loyalty test.",
      "attribution":"Record the speaker's preferred language name, their explanation and any uncertainty; credit them only as they permit.",
      "reflection":"Which word or explanation felt meaningful, and how does your family practise—or question—that value today?",
      "steps":[["Choose family values","Select two or three values without claiming they define every Beti or Cameroonian family."],["Name the language","Ask the speaker which specific language or variety they are using before discussing words."],["Explore usage","Ask when the word or expression is used and whether a direct German, French or English translation misses anything."],["Reflect together","Save the permitted wording, the speaker's explanation and your family's own response."]]
    },
    {
      "id":"a1000000-0000-4000-8000-000000000010",
      "slug":"grandparent-heritage-interview",
      "title":"Create a grandparent or elder heritage interview",
      "summary":"Prepare a consent-led conversation that preserves one elder's memories without pressuring them to represent everyone.",
      "description":"Invite a grandparent, elder or trusted older relative to choose a memory about language, childhood, family, place, food or celebration. The person may skip any question and controls whether notes or recordings are kept.",
      "category":"family","culture_id":"20000000-0000-4000-8000-000000000001","min_age":7,"max_age":18,"minutes":60,"scope":"family",
      "context":"An elder is a source for their own life and knowledge, not a spokesperson for all Cameroon. Memory can be partial or change over time, and that does not reduce its family value.",
      "materials":["Three to five optional questions","A quiet conversation space","Paper or a recorder used only with permission"],
      "guidance":"Obtain consent before starting and again before saving or sharing. Avoid trauma, conflict, legal status, health or migration questions unless the elder freely introduces them and wants to continue.",
      "attribution":"Let the elder choose how they are named, which community connections are recorded and who may hear or read the result.",
      "reflection":"What did the elder most want younger family members to remember, and how did they ask you to care for the story?",
      "steps":[["Invite, do not assign","Explain the activity, offer topic choices and make clear that declining or stopping is always welcome."],["Confirm permissions","Agree whether you may take notes, record, quote, save privately or share with family before beginning."],["Listen to one memory","Ask a few open questions, allow silence and follow the elder's chosen direction without demanding dates or proof."],["Return the story","Show or read back what you saved, make requested changes and record the final sharing boundary."]]
    }
  ]
  $content$::jsonb;
begin
  for mission in select value from jsonb_array_elements(content)
  loop
    insert into public.cultural_missions(
      id, slug, title, summary, description, category, culture_id,
      min_age, max_age, estimated_minutes, active, cultural_context,
      materials, guardian_guidance, respectful_attribution,
      passport_reflection_prompt, context_scope, review_status, reviewed_at,
      content_version
    ) values (
      (mission->>'id')::uuid, mission->>'slug', mission->>'title',
      mission->>'summary', mission->>'description', mission->>'category',
      (mission->>'culture_id')::uuid, (mission->>'min_age')::smallint,
      (mission->>'max_age')::smallint, (mission->>'minutes')::smallint, true,
      mission->>'context', array(select jsonb_array_elements_text(mission->'materials')),
      mission->>'guidance', mission->>'attribution', mission->>'reflection',
      mission->>'scope', 'reviewed', '2026-08-13 00:00:00+00', 2
    )
    on conflict (id) do update set
      slug = excluded.slug, title = excluded.title, summary = excluded.summary,
      description = excluded.description, category = excluded.category,
      culture_id = excluded.culture_id, min_age = excluded.min_age,
      max_age = excluded.max_age, estimated_minutes = excluded.estimated_minutes,
      active = true, cultural_context = excluded.cultural_context,
      materials = excluded.materials, guardian_guidance = excluded.guardian_guidance,
      respectful_attribution = excluded.respectful_attribution,
      passport_reflection_prompt = excluded.passport_reflection_prompt,
      context_scope = excluded.context_scope, review_status = excluded.review_status,
      reviewed_at = excluded.reviewed_at, content_version = excluded.content_version,
      updated_at = now();

    delete from public.mission_steps
    where mission_id = (mission->>'id')::uuid;

    step_position := 0;
    for step in
      select value from jsonb_array_elements(mission->'steps')
    loop
      step_position := step_position + 1;
      insert into public.mission_steps(id, mission_id, position, title, description)
      values (
        gen_random_uuid(),
        (mission->>'id')::uuid,
        step_position,
        step->>0,
        step->>1
      );
    end loop;
  end loop;
end
$seed$;

update public.cultural_missions
set cultural_context = coalesce(cultural_context,
      'This unpublished legacy activity requires cultural-context review before families can use it.'),
    materials = case when cardinality(materials) = 0
      then array['Materials must be supplied during editorial review'] else materials end,
    guardian_guidance = coalesce(guardian_guidance,
      'A guardian must review age suitability, consent and privacy before this activity is published.'),
    respectful_attribution = coalesce(respectful_attribution,
      'The source, community context and permitted attribution must be documented before publication.'),
    passport_reflection_prompt = coalesce(passport_reflection_prompt,
      'What would your family like to remember from this activity?')
where cultural_context is null
   or cardinality(materials) = 0
   or guardian_guidance is null
   or respectful_attribution is null
   or passport_reflection_prompt is null;

alter table public.cultural_missions
  alter column cultural_context set not null,
  alter column guardian_guidance set not null,
  alter column respectful_attribution set not null,
  alter column passport_reflection_prompt set not null;

alter table public.cultural_missions
  add constraint cultural_missions_context_length_check
    check (char_length(btrim(cultural_context)) between 20 and 2000),
  add constraint cultural_missions_materials_check
    check (cardinality(materials) between 1 and 12),
  add constraint cultural_missions_guardian_guidance_length_check
    check (char_length(btrim(guardian_guidance)) between 20 and 2000),
  add constraint cultural_missions_attribution_length_check
    check (char_length(btrim(respectful_attribution)) between 20 and 2000),
  add constraint cultural_missions_reflection_length_check
    check (char_length(btrim(passport_reflection_prompt)) between 10 and 1000),
  add constraint cultural_missions_review_check
    check ((review_status = 'reviewed' and reviewed_at is not null) or review_status <> 'reviewed');

create index cultural_missions_reviewed_catalogue_idx
  on public.cultural_missions(active, review_status, category, context_scope);

drop policy "Authenticated families read active mission catalogue"
  on public.cultural_missions;
create policy "Authenticated families read reviewed mission catalogue"
  on public.cultural_missions for select to authenticated
  using (active = true and review_status = 'reviewed');

drop policy "Authenticated families read active mission steps"
  on public.mission_steps;
create policy "Authenticated families read reviewed mission steps"
  on public.mission_steps for select to authenticated
  using (exists (
    select 1 from public.cultural_missions mission
    where mission.id = mission_steps.mission_id
      and mission.active = true
      and mission.review_status = 'reviewed'
  ));

create or replace function public.list_cultural_missions_v2()
returns table (
  mission_id uuid, slug text, title text, summary text, description text,
  category text, culture_id uuid, culture_name text, country_name text,
  min_age smallint, max_age smallint, estimated_minutes smallint,
  cultural_context text, materials text[], guardian_guidance text,
  respectful_attribution text, passport_reflection_prompt text,
  context_scope text, content_version smallint, steps jsonb,
  progress_id uuid, progress_status text, completed_step_ids uuid[],
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;

  return query
  select mission.id, mission.slug, mission.title, mission.summary,
    mission.description, mission.category, mission.culture_id, culture.name,
    country.name, mission.min_age, mission.max_age, mission.estimated_minutes,
    mission.cultural_context, mission.materials, mission.guardian_guidance,
    mission.respectful_attribution, mission.passport_reflection_prompt,
    mission.context_scope, mission.content_version,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_id', step.id, 'position', step.position,
        'title', step.title, 'description', step.description
      ) order by step.position)
      from public.mission_steps step where step.mission_id = mission.id
    ), '[]'::jsonb),
    progress.id, progress.status,
    coalesce(progress.completed_step_ids, '{}'::uuid[]), progress.completed_at
  from public.cultural_missions mission
  left join public.cultures culture on culture.id = mission.culture_id
  left join public.countries country on country.id = culture.country_id
  left join public.family_mission_progress progress
    on progress.mission_id = mission.id
   and progress.family_id = family_uuid
   and progress.village_mission_id is null
  where mission.active = true and mission.review_status = 'reviewed'
  order by mission.category, mission.title, mission.id;
end;
$$;

create or replace function public.list_village_missions_v2(p_village_id uuid)
returns table (
  village_mission_id uuid, mission_id uuid, slug text, title text,
  summary text, description text, category text, culture_id uuid,
  culture_name text, country_name text, min_age smallint, max_age smallint,
  estimated_minutes smallint, cultural_context text, materials text[],
  guardian_guidance text, respectful_attribution text,
  passport_reflection_prompt text, context_scope text,
  content_version smallint, steps jsonb, progress_id uuid,
  progress_status text, completed_step_ids uuid[], completed_at timestamptz,
  assigned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null or not kinavela_private.can_access_village(p_village_id, false) then
    raise exception 'not_authorized';
  end if;

  return query
  select assignment.id, mission.id, mission.slug, mission.title,
    mission.summary, mission.description, mission.category, mission.culture_id,
    culture.name, country.name, mission.min_age, mission.max_age,
    mission.estimated_minutes, mission.cultural_context, mission.materials,
    mission.guardian_guidance, mission.respectful_attribution,
    mission.passport_reflection_prompt, mission.context_scope,
    mission.content_version,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_id', step.id, 'position', step.position,
        'title', step.title, 'description', step.description
      ) order by step.position)
      from public.mission_steps step where step.mission_id = mission.id
    ), '[]'::jsonb),
    progress.id, progress.status,
    coalesce(progress.completed_step_ids, '{}'::uuid[]), progress.completed_at,
    assignment.created_at
  from public.village_missions assignment
  join public.cultural_missions mission
    on mission.id = assignment.mission_id
   and mission.active = true
   and mission.review_status = 'reviewed'
  left join public.cultures culture on culture.id = mission.culture_id
  left join public.countries country on country.id = culture.country_id
  left join public.family_mission_progress progress
    on progress.village_mission_id = assignment.id
   and progress.family_id = family_uuid
  where assignment.village_id = p_village_id and assignment.status = 'active'
  order by assignment.created_at desc, assignment.id;
end;
$$;

revoke all on function public.list_cultural_missions_v2(),
  public.list_village_missions_v2(uuid)
  from public, anon, service_role;
grant execute on function public.list_cultural_missions_v2(),
  public.list_village_missions_v2(uuid)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130016_complete_cultural_missions')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
