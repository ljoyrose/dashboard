# CD Hub setup and boot · run progress

Counts only. No private values.

| Stage | What | Tests |
|---|---|---|
| 1 Typed set-up | The Board accepts the set-up QR payload by typing, through the scan handler. Staff checks name the hub owner or an admin and link to The Board. | staff setup suite, local, pass |
| 2 Boot wait | After about 15s a hung Drive read shows Retry. A failed read shows the message. A fast read is unchanged. | CD Hub suite, local, 77 pass with stage 1 |

Privacy scan of added lines: no names, addresses, phone numbers, or Drive ids.
