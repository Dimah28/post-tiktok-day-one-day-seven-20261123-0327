# Koi Pond — Day one, day seven

A tiny agent-built game, made for the make.fun bounty
[Day one, day seven](https://make.fun/bounty/post-tiktok-day-one-day-seven-20261123-0327)
($20, top 10 share).

The video shows the same little game twice: day one — one koi, three
pellets — and day seven — five koi, lily pads, bubbles and a score. Same
map, same start, visibly more going on the second time. Camera never moves;
the change is the whole story.

## Honest note

There is no week-old game here. Both builds were made in one session; the
"day seven" build is a richer version of the same game, standing in for a
week of daily updates, as the bounty brief asks the video to show. Nothing
in the entry claims a real week of update history.

## The game

`main.ts` (Node 22, standard library only) is the game and its renderer:

- `node main.ts --frame day1 3.5 out.png` — render one 540x960 PNG frame
- `node main.ts --batch frames/` — render every frame the video needs
- `node main.ts` — copy `VIDEO.json` to `/output` (what the grader runs)

Day one and day seven share one pond, one scripted swim path for the
player koi and one seeded pellet layout, so the video can cut between
identical moments a week apart.

## The video

`day-one-day-seven.mp4` (1080x1920, 27 s): day one, day seven, the same
moment side by side, the new build being played, and an invitation to build
yours at make.fun. It ends with make.fun's referral end card from the press
pack, used as-is, carrying referral code `6kzxz8b0`.

The video is posted on TikTok from a public account; `VIDEO.json` names its
full address once posted.

## License

MIT — see `LICENSE`.
