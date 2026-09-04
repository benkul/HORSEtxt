// The playground's samples. They live here rather than inside playground.html so a
// test can compile every one of them — a sample that does not compile is a sample
// nobody can see is broken.

export const SAMPLES = {
  "a stand": `@ juniper  left bias

band exposure

    # hold the pointer nearly still for three seconds.
    # move it, and nothing happened.
    lead mare develop
        stand 3s within 20px as held
            ^ ears forward   tension ~held ^
        otherwise
            _ ears back _
            balk
        ^ ears forward   lids AU143 ^
        release`,

  "refusal": `band listening

    # a channel that declines is a channel that declined.
    # there is nothing to handle and nothing to report.
    #
    # \`chance\` is a fresh draw. \`weather\` is a shared condition, and gives the
    # same answer to everyone reading it at the same moment.
    lead mare open
        when chance > 0.5
            leave
        ^ ears forward   voice ~0.4:~0.6 ^
        release`,

  "a context": `band room

    # the same snort means different things in different rooms.
    lead mare listen
        context grazing
            hears snort
                ^ ears forward   tension ~0.1 ^

        snort
        release`,

  "agonistic ears": `band warning

    # both ears flattened is agonistic, and an animal that is not attending
    # does not answer signals. the handler below never fires.
    lead mare warn
        context room
            hears snort
                ^ ears forward ^

        _ ears back   nostrils AD38 _
        snort
        release`,

  "which eye you look with": `@ juniper  left bias

band looking

    # the left eye feeds the right hemisphere: novelty, threat, escape.
    # the right eye feeds the left: analytical categorisation.
    #
    # so the side is not decoration on one operation. it selects which question
    # was asked, and you get back a different kind of answer.
    lead mare inspect
        context field
            hears novel
                ^ ears forward   nostrils AD38   tension ~0.6 ^

        # is this new? a truth.
        remember strange as flehmen "a gate" from the left

        # what kind of thing is it? a category.
        remember kind as flehmen [1 2 3] from the right

        # met once, it is no longer new.
        remember again as flehmen "a gate" from the left

        ^ ears forward   head ~0.2 ^
        release kind`,

  "the muzzle": `band holding

    # a horse cannot see its own muzzle. what was handed to you is exactly what
    # you cannot look at, so this cue balks and the caller carries on.
    cue examine thing
        release flehmen thing

    lead mare go
        remember refused as examine [1 2]
        ^ ears forward   tension ~0.1 ^
        release refused`,

  "gaits": `band schedule

    lead mare move
        walk
            blank
            blank
        trot
            blank
            blank
        gallop
            blank
            blank
        release`,

  "affect will not collapse": `band voice

    lead mare speak
        remember call as ~0.8:~-0.3
        remember answer as ~0.1:~0.4

        # two affects combine component-wise and the answer is still a pair.
        remember together as call + answer

        # a scalar reaches arousal and leaves valence alone: intensity scales,
        # sign does not.
        remember louder as call * 2

        # arousal is the axis with an order, so a comparison reads it.
        when louder > answer
            ^ ears forward   voice ~0.9:~-0.3 ^

        # naming an axis is how one number comes out of a pair, and the only
        # way. asking for a single magnitude any other way is a type error.
        release together.valence`,

  "halting a held gait": `band held

    forage rounds of 1 through 3

    # a gait held with \`every\` repeats until something stops it. \`halt\` is that
    # something: it ends the innermost gait it is inside, and nothing more.
    # \`leave\` would end the whole program instead.
    lead mare pace-about
        walk every 60ms
            when rounds.empty
                halt
            remember n as rounds.graze
            ^ ears forward   tension ~(n / 3) ^
        ^ ears forward   head ~0.0 ^
        release`,

  "a late release is punishing": `band slow

    # the release is the reinforcer, and releasing late does not merely take
    # longer: it punishes the response that should have been rewarded. lateness
    # belongs to whoever is slow to let go, and here that is the far side of the
    # boundary -- this cue is handed to javascript, which keeps it for a second
    # and a half before calling it back.
    #
    # time spent standing, or between the strides of a gait, is not this. that is
    # the animal taking the time it was told to take, and it answered immediately.
    cue lets-go-eventually settle refuse
        hands.setTimeout settle 1500
        release

    lead mare dawdle
        remember asked as new hands.Promise lets-go-eventually
        release (asked.then)`,

  "nothing, and none": `band counting

    # zero is a quantity. bare is nothing being there. a horse at a full haynet
    # that has eaten nothing is not a horse standing where there is no haynet,
    # and a language that calls both of them false cannot tell you which one it
    # is looking at.
    #
    # so \`or\` is not a default: it joins answers and gives an answer back. the
    # default is patch use -- the first patch with anything in it.

    remember eaten as 0
    remember name as bare

    lead mare count
        when eaten
            ^ ears forward   head ~0.2 ^

        when not name
            ^ ears divided   head ~0 _

        # walk the patches. the near two are bare and none; none is something.
        remember found as grass in [name eaten "the far patch"]
        ^ tension ~0.2 ^
        release found`,

  "a signal that carried something": `band gates

    # a signal has no meaning of its own. the nearest context decides what it
    # means -- and the handler can name what arrived, which is what makes a
    # context worth having.

    cue creaked which
        snort which
        release 0

    lead mare listen
        context near
            hears snort as gate
                ^ ears forward   head ~0.4   nostrils AD38 ^
                release ("that one moved: " + gate)

        remember answer as (creaked "the far gate")
        ^ tension ~0.2 ^
        release answer`,

  "a cue held under another name": `band naming

    # a cue in expression position is the cue itself, so a cue held under another
    # name calls fine and a dispatch table is expressible.
    #
    # the name a call is written under is the handler's word for the signal, not a
    # second signal. training does not follow the word: it stays with the cue, and
    # the count is kept against the name it was taught under.

    cue soft
        release "soft"

    cue loud
        release "loud"

    cue answer-with f
        release (f)

    cue for-the-hour hour
        when (hour < 7)
            release soft
        release loud

    lead mare speak
        remember chosen as (for-the-hour 3)
        release (answer-with chosen)`,

  "a stride that did not land": `band footing

    remember steps as 0

    # a stumble is not a fall and it is not a halt: the horse gathers itself and
    # takes the next stride. nothing after the bad hoof happens, including the
    # suspension -- a stumble is where the rhythm breaks.
    lead mare cross
        walk every 200ms
            steps becomes steps + 1
            when (steps < 3)
                stumble
            halt
        ^ ears forward   tension ~(steps / 5) ^
        release steps`,

  "the band is too large": `band crowded

    cue one
        release 1
    cue two
        release 2
    cue three
        release 3
    cue four
        release 4
    cue five
        release 5

    lead mare go
        release`,
};
