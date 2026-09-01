# ClickyBench

Live: https://joeygirdhar.github.io/clickybench/

## The problem

HeyClicky watches your screen and teaches you something by drawing on top of what you are
already looking at. The part that bothers me is what happens afterward: nothing. Every
walkthrough is single player, and it disappears when you close it. You learn the thing, the
drawing goes away, and the person next to you who gets stuck on the same step tomorrow starts
from zero. Raising the step cap from 5 to 15 suggests people are using these for real work,
which makes it stranger that none of it can be handed to anyone.

## Where it showed up

My AP Stats teacher was walking the class through an online TI 84 on the projector, step by
step. When I described HeyClicky to her afterward, her reaction was that she would want to do
it once and post the recording to Google Classroom so every student could replay it. That is
the same gap, from the other side of the desk.

## What this is

A working prototype of the missing piece: a walkthrough as a portable file you can create,
hand to someone, replay, and be tested on.

It has three parts. You build a walkthrough by pasting screenshots and marking each one with
an arrow, a circle, a numbered badge, or a spotlight, plus a plain English intent and an
optional note. You export the whole thing as one JSON file with the images embedded inside it,
so it survives being emailed. Then anyone can import that file and play it, in Full, in
Speedrun (annotation and intent, no note), or in Socratic, which shows the intent and a rough
region and makes you guess before it reveals the exact spot. After the last step it quizzes
you: three random steps, screenshot with the annotation stripped out, intent as the prompt,
one click each. It scores by pixel distance from the annotation's target point and shows you
the right answer either way, so a miss still teaches you something.

There is no backend, no account, and no network call anywhere in it. Nothing is written to
localStorage either. The file is the persistence layer, which is the whole argument.

## Try it in 30 seconds

Open the live link, click "Load the example walkthrough", then Play. Pick Socratic if you only
have time for one mode, since it is the one that shows why the format is shaped the way it is.
The same walkthrough lives at `examples/example.json`, and Import takes that or any other
export from disk. Drag and drop works too.

The example ships with labelled placeholder images rather than screenshots of real software.
To swap in real ones: load it, use Replace image on each step, then Export and overwrite
`examples/example.json`. It gets inlined into the bundle at build time so the live page can
demo itself without a network call, so keep it reasonably small.

## The point of the intent field

A screenshot is a picture of one specific machine. Different window size, different app
version, panels dragged somewhere else, a menu that moved in the last update, and the image is
now a picture of something that no longer matches what the other person is looking at. The
pixels are not transferable. What is transferable is what the step was *for*.

So every step carries an `intent`: a short imperative description of the action, like "open
the Effects panel" or "click the crop tool in the left toolbar". The screenshot stays as the
reference image for a human, and the intent is the part a machine on the other end could
actually act on. Find that thing on *this* screen, wherever it happens to be today.

That is the version this is aiming at. HeyClicky writes the file itself after it walks you
through something, and someone else's Clicky reads it and runs the walkthrough live on their
own screen, resolving each intent against whatever is actually in front of them. This
prototype is the format that would sit between the two, made by hand so I could find out
whether it holds up.

The separation earns its keep immediately, before any of that exists. Socratic mode works only
because the intent and the annotation are different fields: the intent is the hint, the
annotation is the answer. Same reason the quiz can ask a question at all. It shows you the
intent and hides the coordinates.

## The file format

One JSON object: a `title`, a `createdAt`, and an ordered array of steps. Coordinates are
percentages of the natural image dimensions, never absolute pixels, so a step lands in the
same place whatever size it gets rendered at. Images are base64 data URLs, downscaled to
1600px on the long edge when they come in, and never referenced externally.

```jsonc
{
  "format": "clickybench/walkthrough",
  "version": 1,
  "title": "Summary stats on an online graphing calculator",
  "steps": [
    {
      "id": "ex1",
      // The part a machine could act on. Short, imperative, no coordinates.
      "intent": "open the STAT menu",
      // For a human. Hidden in Speedrun, and until you reveal in Socratic.
      "note": "Everything to do with lists and summaries starts here.",
      "image": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0i...",
      "imageWidth": 1600,
      "imageHeight": 1000,
      // Percentages of the image, 0 to 100. Tail (x1,y1) to head (x2,y2).
      // The head is this step's target point, which is what the quiz scores.
      "annotation": { "kind": "arrow", "x1": 8, "y1": 62, "x2": 22, "y2": 33 }
    }
  ]
}
```

The other three annotation kinds are `ellipse` (`cx`, `cy`, `rx`, `ry`), `badge` (`x`, `y`,
`n`), and `spotlight` (`x`, `y`, `w`, `h`, dimming everything outside the rectangle). Each one
resolves to a single target point: arrow head, ellipse center, badge anchor, spotlight center.
That point is what Socratic mode centers its hint on, and what a click gets scored against. A
hit is within the larger of 40px or 4% of the image's long edge. Imports are validated, and a
malformed file gets a specific error rather than a blank screen.

## What this isn't

A standalone prototype, built in one night to test whether the format survives contact with
real use. It is not integrated with HeyClicky, not affiliated with them, and does not talk to
anything they run. Making the files is still manual, which is the part that would go away in
the real version. The point was the shape of the file, not the app around it.

## Running it locally

`npm install`, then `npm run dev`. `npm run build` produces the static site. If you fork this
under a different repo name, change `base` in `vite.config.ts` to match, or GitHub Pages will
serve you a blank white page.
