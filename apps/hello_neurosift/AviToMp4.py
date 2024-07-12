import os
from pairio.sdk import ProcessorBase, BaseModel, Field, InputFile, OutputFile

class AviToMp4Context(BaseModel):
    input: InputFile = Field(description='Input .avi file')
    output: OutputFile = Field(description='Output .mp4 file')
    duration_sec: str = Field(description='The duration of the output video in seconds', default=10)


class AviToMp4Processor(ProcessorBase):
    name = 'avi_to_mp4'
    description = 'Convert an .avi file to an .mp4 file'
    label = 'avi_to_mp4'
    image = 'magland/pairio-hello-neurosift:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: AviToMp4Context
    ):
        avi_url = context.input.get_url()
        duration_sec = context.duration_sec

        mp4_fname = 'output.mp4'
        print('Converting .avi to .mp4')
        ffmpeg_command = f"ffmpeg -ss 00:00:00 -i {avi_url} -t {duration_sec} -c:v libx264 -c:a aac {mp4_fname}"

        # Execute the command
        os.system(ffmpeg_command)

        context.output.upload(mp4_fname, delete_local_file=True)
