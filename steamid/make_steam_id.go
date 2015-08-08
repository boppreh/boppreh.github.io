package main

import (
        "hash/crc32"
        "io/ioutil"
        "strconv"
)

func main() {
        in, err := ioutil.ReadFile("value.txt")
        if err != nil {
                panic(err)
        }
        top := uint64(crc32.ChecksumIEEE(in)) | 0x80000000
        out := []byte(strconv.FormatUint(top<<32|0x02000000, 10))
        err = ioutil.WriteFile("value.txt", out, 0700)
        if err != nil {
                panic(err)
        }
}
