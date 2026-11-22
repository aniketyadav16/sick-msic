import Foundation
import AVFoundation
import Speech

func emit(_ event: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: event),
          let text = String(data: data, encoding: .utf8) else { return }
    print(text)
    fflush(stdout)
}

final class VoiceSession {
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var recognizer: SFSpeechRecognizer?
    private var silenceTimer: Timer?
    private var deadline: Timer?
    private var tapped = false
    private var finished = false
    private var finalizing = false
    private var transcript = ""

    func fail(_ code: String) {
        guard !finished else { return }
        emit(["type": "error", "code": code])
        stop()
    }

    func stop() {
        guard !finished else { return }
        finished = true
        silenceTimer?.invalidate()
        deadline?.invalidate()
        stopAudio()
        task?.cancel()
        task = nil
        emit(["type": "end"])
        exit(0)
    }

    private func stopAudio() {
        engine.stop()
        if tapped { engine.inputNode.removeTap(onBus: 0); tapped = false }
        request?.endAudio()
    }

    private func complete() {
        guard !finished else { return }
        if transcript.isEmpty { fail("no-speech"); return }
        // Release the microphone before the app starts playing the matched song.
        stopAudio()
        emit(["type": "result", "text": transcript, "final": true])
        stop()
    }

    private func finishUtterance() {
        guard !finished, !finalizing else { return }
        finalizing = true
        stopAudio()
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: false) { [weak self] _ in self?.complete() }
    }

    func start(locale: String) {
        guard let speech = SFSpeechRecognizer(locale: Locale(identifier: locale)) else { fail("language-not-supported"); return }
        recognizer = speech
        emit(["type": "status", "status": "permission"])
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard !self.finished else { return }
                guard status == .authorized else { self.fail("speech-permission"); return }
                AVCaptureDevice.requestAccess(for: .audio) { granted in
                    DispatchQueue.main.async {
                        guard !self.finished else { return }
                        guard granted else { self.fail("microphone-permission"); return }
                        self.listen()
                    }
                }
            }
        }
    }

    private func listen() {
        guard let speech = recognizer, speech.isAvailable else { fail("service-unavailable"); return }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .search
        // Prefer local recognition where the selected language supports it.
        if speech.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
        self.request = request
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { fail("audio-capture"); return }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
        tapped = true
        task = speech.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self, !self.finished else { return }
                if let result = result {
                    let text = result.bestTranscription.formattedString
                    if text != self.transcript {
                        self.transcript = text
                        emit(["type": "result", "text": text, "final": false])
                        if !self.finalizing {
                            self.silenceTimer?.invalidate()
                            self.silenceTimer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: false) { [weak self] _ in self?.finishUtterance() }
                        }
                    }
                    if result.isFinal { self.complete(); return }
                }
                if error != nil {
                    if self.finalizing && !self.transcript.isEmpty { self.complete() }
                    else { self.fail("recognition-failed") }
                }
            }
        }
        do { engine.prepare(); try engine.start() }
        catch { fail("audio-capture"); return }
        emit(["type": "listening"])
        deadline = Timer.scheduledTimer(withTimeInterval: 20, repeats: false) { [weak self] _ in self?.finishUtterance() }
    }
}

let locale = CommandLine.arguments.dropFirst().first ?? "en-IN"
if locale == "--check" {
    emit(["type": "check", "microphone": AVCaptureDevice.authorizationStatus(for: .audio).rawValue,
          "speech": SFSpeechRecognizer.authorizationStatus().rawValue,
          "availableLocales": SFSpeechRecognizer.supportedLocales().map { $0.identifier }.sorted()])
    exit(0)
}
let session = VoiceSession()
// Closing Electron or the renderer's pipe must also release the microphone.
DispatchQueue.global().async {
    _ = readLine()
    DispatchQueue.main.async { session.stop() }
}
signal(SIGTERM, SIG_IGN)
let termination = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
termination.setEventHandler { session.stop() }
termination.resume()
DispatchQueue.main.async { session.start(locale: locale) }
RunLoop.main.run()
