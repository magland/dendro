import os
from dendro.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class AviToMp4Context(BaseModel):
    input: InputFile = Field(description='Input .avi file')
    output: OutputFile = Field(description='Output .mp4 file')
    info: OutputFile = Field(description='Output .json info file')
    duration_sec: str = Field(description='The duration of the output video in seconds', default=10)


class AviToMp4Processor(ProcessorBase):
    name = 'avi_to_mp4'
    description = 'Convert an .avi file to an .mp4 file'
    label = 'avi_to_mp4'
    image = 'magland/dendro-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: AviToMp4Context
    ):
        import json
        avi_url = context.input.get_url()
        if not avi_url:
            raise Exception('Unable to get URL for input .avi file')
        duration_sec = context.duration_sec

        total_duration_sec = _get_total_duration_sec(avi_url)

        mp4_fname = 'output.mp4'
        print('Converting .avi to .mp4')
        ffmpeg_command = f"ffmpeg -ss 00:00:00 -i {avi_url} -t {duration_sec} -c:v libx264 -c:a aac {mp4_fname}"

        # Execute the command
        os.system(ffmpeg_command)

        context.output.upload(mp4_fname, delete_local_file=True)

        # Save the info
        info = {
            'total_duration_sec': total_duration_sec
        }
        with open('info.json', 'w') as f:
            json.dump(info, f)
        context.info.upload('info.json', delete_local_file=True)


def _get_total_duration_sec(avi_url: str):
    import cv2
    cap = cv2.VideoCapture(avi_url)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    total_duration_sec = total_frames / fps
    return total_duration_sec
