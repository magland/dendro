import sys
import urllib.request
import time


url1 = 'https://api.dandiarchive.org/api/assets/c04f6b30-82bf-40e1-9210-34f0bcd8be24/download/'

def benchmark_download_100mb():
    with TimeIt(label='Download 100 MB') as tt:
        num_bytes = 100_000_000
        download_data(url1, num_bytes)
        elapsed_sec = tt.elapsed()
        rate = num_bytes / elapsed_sec
        print(f'Rate: {rate / 1_000_000:.2f} MB/s')


def benchmark_download_1gb():
    with TimeIt(label='Download 1 GB') as tt:
        num_bytes = 1_000_000_000
        download_data(url1, num_bytes)
        elapsed_sec = tt.elapsed()
        rate = num_bytes / elapsed_sec
        print(f'Rate: {rate / 1_000_000:.2f} MB/s')


def download_data(url, num_bytes):
    headers = {'Range': f'bytes=0-{num_bytes - 1}'}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        response.read()


class TimeIt:
    def __init__(self, label):
        self.label = label

    def __enter__(self):
        print(f'Starting {self.label}')
        self.start = time.time()
        return self

    def __exit__(self, *args):
        print(f'{self.label}: {time.time() - self.start:.2f} seconds')

    def elapsed(self):
        return time.time() - self.start


benchmarks = [
    ('download_100mb', benchmark_download_100mb),
    ('download_1gb', benchmark_download_1gb),
]

if __name__ == '__main__':
    # get first command line argument
    if len(sys.argv) < 2:
        print('Usage:')
        for name, _ in benchmarks:
            print(f'  python benchmarks.py {name}')
        sys.exit(1)
    benchmark_name = sys.argv[1]
    for name, benchmark in benchmarks:
        if name == benchmark_name:
            benchmark()
            break
    else:
        print(f'Unknown benchmark: {benchmark_name}')
        sys.exit(1)
