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
    lead mare open
        when weather.wet > 0.5
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
        # arousal and valence are independent and do not reduce to one pitch.
        # asking for a single magnitude is a type error.
        release call.arousal`,

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

    forage strides of 1 through 5

    # the release is the reinforcer. releasing late does not merely take longer:
    # it punishes the response it should reward. this cue takes well over a second
    # to release, and says so.
    lead mare dawdle
        walk every 300ms
            when strides.empty
                halt
            ^ tension ~(strides.graze / 5) ^
        release`,

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
